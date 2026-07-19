<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

/**
 * Reusable audit logging service.
 *
 * Logs admin/super-admin actions with old/new values,
 * IP address, and user agent for traceability.
 */
class AuditService
{
    /**
     * Log an auditable action.
     *
     * @param string     $action     Action identifier (e.g. 'settings.updated', 'code.generated')
     * @param Model|null $auditable  The model being acted on (polymorphic)
     * @param array|null $oldValues  Previous state
     * @param array|null $newValues  New state
     */
    public static function log(
        string $action,
        ?Model $auditable = null,
        ?array $oldValues = null,
        ?array $newValues = null,
    ): AuditLog {
        return AuditLog::create([
            'user_id' => Auth::id(),
            'action' => $action,
            'auditable_type' => $auditable ? get_class($auditable) : null,
            'auditable_id' => $auditable?->getKey(),
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
        ]);
    }
}
