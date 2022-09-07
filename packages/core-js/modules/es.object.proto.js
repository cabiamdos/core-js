'use strict';
var DESCRIPTORS = require('../internals/descriptors');
var defineBuiltInAccessor = require('../internals/define-built-in-accessor');
var isObject = require('../internals/is-object');
var toObject = require('../internals/to-object');
var requireObjectCoercible = require('../internals/require-object-coercible');

// eslint-disable-next-line es-x/no-object-getprototypeof -- safe
var getPrototypeOf = Object.getPrototypeOf;
// eslint-disable-next-line es-x/no-object-setprototypeof -- safe
var setPrototypeOf = Object.setPrototypeOf;
var ObjectPrototype = Object.prototype;
var PROTO = '__proto__';

// `Object.prototype.__proto__` accessor
// https://tc39.es/ecma262/#sec-object.prototype.__proto__
if (DESCRIPTORS && getPrototypeOf && setPrototypeOf && !(PROTO in ObjectPrototype)) try {
  defineBuiltInAccessor(ObjectPrototype, PROTO, {
    configurable: true,
    get: function __proto__() {
      return getPrototypeOf(toObject(this));
    },
    set: function __proto__(proto) {
      var O = requireObjectCoercible(this);
      if (!isObject(proto) && proto !== null || !isObject(O)) return;
      setPrototypeOf(O, proto);
    }
  });
} catch (error) { /* empty */ }