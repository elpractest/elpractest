<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Product;
use App\Models\ProductItem;
use App\Models\TestSeries;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Admin CRUD for the storefront.
 *
 * A product is only ever as good as its items, so create and update both take
 * the item list inline — an admin should never be able to publish something
 * that takes money and grants nothing.
 */
class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Product::withCount('items', 'entitlements');

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('exam_category')) {
            $query->where('exam_category', $request->exam_category);
        }

        if ($request->filled('is_published')) {
            $query->where('is_published', $request->boolean('is_published'));
        }

        return response()->json(
            $query->orderBy('sort_order')->orderByDesc('id')->paginate(20)
        );
    }

    public function show(Product $product): JsonResponse
    {
        return response()->json($product->load('items.grantable', 'items.batch'));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $product = DB::transaction(function () use ($data, $request) {
            $product = Product::create(collect($data)->except('items')->toArray() + [
                'created_by' => $request->user()->id,
                'is_published' => false, // starts as a draft, like tests and series
            ]);

            $this->syncItems($product, $data['items']);

            return $product;
        });

        AuditService::log('product.created', $product, null, $product->toArray());

        return response()->json([
            'message' => 'Product created.',
            'product' => $product->load('items.grantable'),
        ], 201);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $data = $this->validated($request, $product);
        $old = $product->load('items')->toArray();

        DB::transaction(function () use ($product, $data) {
            $product->update(collect($data)->except('items')->toArray());

            if (array_key_exists('items', $data)) {
                $this->syncItems($product, $data['items']);
            }
        });

        AuditService::log('product.updated', $product, $old, $product->fresh()->toArray());

        return response()->json([
            'message' => 'Product updated.',
            'product' => $product->fresh()->load('items.grantable'),
        ]);
    }

    /**
     * Publishing is a gate, not a flag: an empty product would charge for
     * nothing, so it is refused here the same way an empty test is refused.
     */
    public function publish(Product $product): JsonResponse
    {
        if ($product->items()->count() === 0) {
            return response()->json([
                'message' => 'Cannot publish a product that grants nothing. Add at least one course or test series.',
            ], 422);
        }

        $missing = $product->items()->with('grantable')->get()
            ->filter(fn ($item) => $item->grantable === null);

        if ($missing->isNotEmpty()) {
            return response()->json([
                'message' => 'This product references ' . $missing->count() . ' item(s) that no longer exist.',
            ], 422);
        }

        $product->update(['is_published' => true]);
        AuditService::log('product.published', $product, null, $product->toArray());

        return response()->json(['message' => 'Product published.', 'product' => $product]);
    }

    public function unpublish(Product $product): JsonResponse
    {
        $product->update(['is_published' => false]);
        AuditService::log('product.unpublished', $product, null, $product->toArray());

        return response()->json(['message' => 'Product unpublished.', 'product' => $product]);
    }

    /**
     * Soft delete. Entitlements already granted are untouched — someone paid for
     * them, and pulling a product from sale must never withdraw what it sold.
     */
    public function destroy(Product $product): JsonResponse
    {
        $product->update(['is_published' => false]);
        $product->delete();

        AuditService::log('product.deleted', $product, null, null);

        return response()->json([
            'message' => 'Product removed from the store. Existing purchases keep their access.',
        ]);
    }

    private function validated(Request $request, ?Product $product = null): array
    {
        $slugRule = Rule::unique('products', 'slug');
        if ($product) {
            $slugRule = $slugRule->ignore($product->id);
        }

        $required = $product ? 'sometimes' : 'required';

        return $request->validate([
            'type' => [$required, 'string', Rule::in(Product::TYPES)],
            'title' => [$required, 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', $slugRule],
            'description' => ['nullable', 'string'],
            'short_description' => ['nullable', 'string', 'max:1000'],
            'exam_category' => [$required, 'string', Rule::in(config('exams.categories'))],
            'price_paise' => [$required, 'integer', 'min:0'],
            'list_price_paise' => ['nullable', 'integer', 'min:0'],
            'access_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
            'play_product_id' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0'],

            'items' => [$required, 'array', 'min:1'],
            'items.*.kind' => ['required', 'string', Rule::in(['course', 'test_series', 'question_pool'])],
            'items.*.id' => ['required', 'integer'],
            'items.*.batch_id' => ['nullable', 'integer', 'exists:batches,id'],
        ]);
    }

    /**
     * Replace the item list wholesale. Existing entitlements are unaffected —
     * they were resolved to concrete courses and series at purchase time, which
     * is exactly so that editing a bundle cannot rewrite what someone bought.
     */
    private function syncItems(Product $product, array $items): void
    {
        $product->items()->delete();

        foreach ($items as $index => $item) {
            // A question pool grants practice access to a slice of the bank.
            // It costs nothing extra here because product_items and
            // entitlements were already polymorphic — only the vocabulary of
            // what they may point at has widened.
            $class = match ($item['kind']) {
                'course' => Course::class,
                'test_series' => TestSeries::class,
                'question_pool' => \App\Models\QuestionPool::class,
            };

            // Validated here rather than with an `exists` rule, because the table
            // depends on the sibling `kind` field.
            if (!$class::whereKey($item['id'])->exists()) {
                abort(422, "That {$item['kind']} does not exist.");
            }

            ProductItem::create([
                'product_id' => $product->id,
                'grantable_type' => $class,
                'grantable_id' => $item['id'],
                'batch_id' => $item['kind'] === 'course' ? ($item['batch_id'] ?? null) : null,
                'sort_order' => $index,
            ]);
        }
    }
}
