'use strict';
// https://github.com/tc39/proposal-async-explicit-resource-management
var $ = require('../internals/export');
var DESCRIPTORS = require('../internals/descriptors');
var getBuiltIn = require('../internals/get-built-in');
var aCallable = require('../internals/a-callable');
var anObject = require('../internals/an-object');
var anInstance = require('../internals/an-instance');
var isNullOrUndefined = require('../internals/is-null-or-undefined');
var defineBuiltIn = require('../internals/define-built-in');
var defineBuiltIns = require('../internals/define-built-ins');
var defineBuiltInAccessor = require('../internals/define-built-in-accessor');
var wellKnownSymbol = require('../internals/well-known-symbol');
var InternalStateModule = require('../internals/internal-state');
var DisposableStackHelpers = require('../internals/disposable-stack-helpers');

var Promise = getBuiltIn('Promise');
var SuppressedError = getBuiltIn('SuppressedError');
var $ReferenceError = ReferenceError;

var ASYNC_DISPOSE = wellKnownSymbol('asyncDispose');
var TO_STRING_TAG = wellKnownSymbol('toStringTag');

var getDisposeMethod = DisposableStackHelpers.getDisposeMethod;
var addDisposableResource = DisposableStackHelpers.addDisposableResource;

var ASYNC_DISPOSABLE_STACK = 'AsyncDisposableStack';
var setInternalState = InternalStateModule.set;
var getAsyncDisposableStackInternalState = InternalStateModule.getterFor(ASYNC_DISPOSABLE_STACK);

var HINT = 'async-dispose';
var DISPOSED = 'disposed';
var PENDING = 'pending';

var ALREADY_DISPOSED = ASYNC_DISPOSABLE_STACK + ' already disposed';

var $AsyncDisposableStack = function AsyncDisposableStack() {
  setInternalState(anInstance(this, AsyncDisposableStackPrototype), {
    type: ASYNC_DISPOSABLE_STACK,
    state: PENDING,
    stack: []
  });

  if (!DESCRIPTORS) this.disposed = false;
};

var AsyncDisposableStackPrototype = $AsyncDisposableStack.prototype;

defineBuiltIns(AsyncDisposableStackPrototype, {
  disposeAsync: function disposeAsync() {
    var asyncDisposableStack = this;
    return new Promise(function (resolve, reject) {
      var internalState = getAsyncDisposableStackInternalState(asyncDisposableStack);
      if (internalState.state == DISPOSED) return resolve(undefined);
      internalState.state = DISPOSED;
      if (!DESCRIPTORS) asyncDisposableStack.disposed = true;
      var stack = internalState.stack;
      var i = stack.length;
      var thrown = false;
      var suppressed;

      var handleError = function (result) {
        if (thrown) {
          suppressed = new SuppressedError(result, suppressed);
        } else {
          thrown = true;
          suppressed = result;
        }

        loop();
      };

      var loop = function () {
        if (i) {
          var disposeMethod = stack[--i];
          try {
            Promise.resolve(disposeMethod()).then(loop, handleError);
          } catch (error) {
            handleError(error);
          }
        } else {
          internalState.stack = null;
          thrown ? reject(suppressed) : resolve(undefined);
        }
      };

      loop();
    });
  },
  use: function use(value) {
    var internalState = getAsyncDisposableStackInternalState(this);
    if (internalState.state == DISPOSED) throw $ReferenceError(ALREADY_DISPOSED);
    if (!isNullOrUndefined(value)) {
      anObject(value);
      var method = aCallable(getDisposeMethod(value, HINT));
      addDisposableResource(internalState, value, HINT, method);
    } return value;
  },
  adopt: function adopt(value, onDispose) {
    var internalState = getAsyncDisposableStackInternalState(this);
    if (internalState.state == DISPOSED) throw $ReferenceError(ALREADY_DISPOSED);
    aCallable(onDispose);
    addDisposableResource(internalState, undefined, HINT, function () {
      onDispose(value);
    });
    return value;
  },
  defer: function defer(onDispose) {
    var internalState = getAsyncDisposableStackInternalState(this);
    if (internalState.state == DISPOSED) throw $ReferenceError(ALREADY_DISPOSED);
    aCallable(onDispose);
    addDisposableResource(internalState, undefined, HINT, onDispose);
  },
  move: function move() {
    var internalState = getAsyncDisposableStackInternalState(this);
    if (internalState.state == DISPOSED) throw $ReferenceError(ALREADY_DISPOSED);
    var newAsyncDisposableStack = new $AsyncDisposableStack();
    getAsyncDisposableStackInternalState(newAsyncDisposableStack).stack = internalState.stack;
    internalState.stack = [];
    return newAsyncDisposableStack;
  }
});

if (DESCRIPTORS) defineBuiltInAccessor(AsyncDisposableStackPrototype, 'disposed', {
  configurable: true,
  get: function disposed() {
    return getAsyncDisposableStackInternalState(this).state == DISPOSED;
  }
});

defineBuiltIn(AsyncDisposableStackPrototype, ASYNC_DISPOSE, AsyncDisposableStackPrototype.disposeAsync, { name: 'disposeAsync' });
defineBuiltIn(AsyncDisposableStackPrototype, TO_STRING_TAG, ASYNC_DISPOSABLE_STACK, { nonWritable: true });

$({ global: true, constructor: true, forced: true }, {
  AsyncDisposableStack: $AsyncDisposableStack
});
