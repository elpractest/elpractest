<?php

namespace App\Exceptions;

use Exception;

class BatchCapacityExceededException extends Exception
{
    protected $message = 'This batch has reached its maximum student capacity.';
}
