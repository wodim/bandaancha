/*  Prototype JavaScript framework, version 1.7
 *  (c) 2005-2010 Sam Stephenson
 *
 *  Prototype is freely distributable under the terms of an MIT-style license.
 *  For details, see the Prototype web site: http://www.prototypejs.org/
 *
 *--------------------------------------------------------------------------*/

var Prototype = {

  Version: '1.7',

  Browser: (function(){
    var ua = navigator.userAgent;
    var isOpera = Object.prototype.toString.call(window.opera) == '[object Opera]';
    return {
      IE:             !!window.attachEvent && !isOpera,
      Opera:          isOpera,
      WebKit:         ua.indexOf('AppleWebKit/') > -1,
      Gecko:          ua.indexOf('Gecko') > -1 && ua.indexOf('KHTML') === -1,
      MobileSafari:   /Apple.*Mobile/.test(ua)
    }
  })(),

  BrowserFeatures: {
    XPath: !!document.evaluate,

    SelectorsAPI: !!document.querySelector,

    ElementExtensions: (function() {
      var constructor = window.Element || window.HTMLElement;
      return !!(constructor && constructor.prototype);
    })(),
    SpecificElementExtensions: (function() {
      if (typeof window.HTMLDivElement !== 'undefined')
        return true;

      var div = document.createElement('div'),
          form = document.createElement('form'),
          isSupported = false;

      if (div['__proto__'] && (div['__proto__'] !== form['__proto__'])) {
        isSupported = true;
      }

      div = form = null;

      return isSupported;
    })()
  },

  ScriptFragment: '<script[^>]*>([\\S\\s]*?)<\/script>',
  JSONFilter: /^\/\*-secure-([\s\S]*)\*\/\s*$/,

  emptyFunction: function() { },

  K: function(x) { return x }
};

if (Prototype.Browser.MobileSafari)
  Prototype.BrowserFeatures.SpecificElementExtensions = false;


var Abstract = { };


var Try = {
  these: function() {
    var returnValue;

    for (var i = 0, length = arguments.length; i < length; i++) {
      var lambda = arguments[i];
      try {
        returnValue = lambda();
        break;
      } catch (e) { }
    }

    return returnValue;
  }
};

/* Based on Alex Arnell's inheritance implementation. */

var Class = (function() {

  var IS_DONTENUM_BUGGY = (function(){
    for (var p in { toString: 1 }) {
      if (p === 'toString') return false;
    }
    return true;
  })();

  function subclass() {};
  function create() {
    var parent = null, properties = $A(arguments);
    if (Object.isFunction(properties[0]))
      parent = properties.shift();

    function klass() {
      this.initialize.apply(this, arguments);
    }

    Object.extend(klass, Class.Methods);
    klass.superclass = parent;
    klass.subclasses = [];

    if (parent) {
      subclass.prototype = parent.prototype;
      klass.prototype = new subclass;
      parent.subclasses.push(klass);
    }

    for (var i = 0, length = properties.length; i < length; i++)
      klass.addMethods(properties[i]);

    if (!klass.prototype.initialize)
      klass.prototype.initialize = Prototype.emptyFunction;

    klass.prototype.constructor = klass;
    return klass;
  }

  function addMethods(source) {
    var ancestor   = this.superclass && this.superclass.prototype,
        properties = Object.keys(source);

    if (IS_DONTENUM_BUGGY) {
      if (source.toString != Object.prototype.toString)
        properties.push("toString");
      if (source.valueOf != Object.prototype.valueOf)
        properties.push("valueOf");
    }

    for (var i = 0, length = properties.length; i < length; i++) {
      var property = properties[i], value = source[property];
      if (ancestor && Object.isFunction(value) &&
          value.argumentNames()[0] == "$super") {
        var method = value;
        value = (function(m) {
          return function() { return ancestor[m].apply(this, arguments); };
        })(property).wrap(method);

        value.valueOf = method.valueOf.bind(method);
        value.toString = method.toString.bind(method);
      }
      this.prototype[property] = value;
    }

    return this;
  }

  return {
    create: create,
    Methods: {
      addMethods: addMethods
    }
  };
})();
(function() {

  var _toString = Object.prototype.toString,
      NULL_TYPE = 'Null',
      UNDEFINED_TYPE = 'Undefined',
      BOOLEAN_TYPE = 'Boolean',
      NUMBER_TYPE = 'Number',
      STRING_TYPE = 'String',
      OBJECT_TYPE = 'Object',
      FUNCTION_CLASS = '[object Function]',
      BOOLEAN_CLASS = '[object Boolean]',
      NUMBER_CLASS = '[object Number]',
      STRING_CLASS = '[object String]',
      ARRAY_CLASS = '[object Array]',
      DATE_CLASS = '[object Date]',
      NATIVE_JSON_STRINGIFY_SUPPORT = window.JSON &&
        typeof JSON.stringify === 'function' &&
        JSON.stringify(0) === '0' &&
        typeof JSON.stringify(Prototype.K) === 'undefined';

  function Type(o) {
    switch(o) {
      case null: return NULL_TYPE;
      case (void 0): return UNDEFINED_TYPE;
    }
    var type = typeof o;
    switch(type) {
      case 'boolean': return BOOLEAN_TYPE;
      case 'number':  return NUMBER_TYPE;
      case 'string':  return STRING_TYPE;
    }
    return OBJECT_TYPE;
  }

  function extend(destination, source) {
    for (var property in source)
      destination[property] = source[property];
    return destination;
  }

  function inspect(object) {
    try {
      if (isUndefined(object)) return 'undefined';
      if (object === null) return 'null';
      return object.inspect ? object.inspect() : String(object);
    } catch (e) {
      if (e instanceof RangeError) return '...';
      throw e;
    }
  }

  function toJSON(value) {
    return Str('', { '': value }, []);
  }

  function Str(key, holder, stack) {
    var value = holder[key],
        type = typeof value;

    if (Type(value) === OBJECT_TYPE && typeof value.toJSON === 'function') {
      value = value.toJSON(key);
    }

    var _class = _toString.call(value);

    switch (_class) {
      case NUMBER_CLASS:
      case BOOLEAN_CLASS:
      case STRING_CLASS:
        value = value.valueOf();
    }

    switch (value) {
      case null: return 'null';
      case true: return 'true';
      case false: return 'false';
    }

    type = typeof value;
    switch (type) {
      case 'string':
        return value.inspect(true);
      case 'number':
        return isFinite(value) ? String(value) : 'null';
      case 'object':

        for (var i = 0, length = stack.length; i < length; i++) {
          if (stack[i] === value) { throw new TypeError(); }
        }
        stack.push(value);

        var partial = [];
        if (_class === ARRAY_CLASS) {
          for (var i = 0, length = value.length; i < length; i++) {
            var str = Str(i, value, stack);
            partial.push(typeof str === 'undefined' ? 'null' : str);
          }
          partial = '[' + partial.join(',') + ']';
        } else {
          var keys = Object.keys(value);
          for (var i = 0, length = keys.length; i < length; i++) {
            var key = keys[i], str = Str(key, value, stack);
            if (typeof str !== "undefined") {
               partial.push(key.inspect(true)+ ':' + str);
             }
          }
          partial = '{' + partial.join(',') + '}';
        }
        stack.pop();
        return partial;
    }
  }

  function stringify(object) {
    return JSON.stringify(object);
  }

  function toQueryString(object) {
    return $H(object).toQueryString();
  }

  function toHTML(object) {
    return object && object.toHTML ? object.toHTML() : String.interpret(object);
  }

  function keys(object) {
    if (Type(object) !== OBJECT_TYPE) { throw new TypeError(); }
    var results = [];
    for (var property in object) {
      if (object.hasOwnProperty(property)) {
        results.push(property);
      }
    }
    return results;
  }

  function values(object) {
    var results = [];
    for (var property in object)
      results.push(object[property]);
    return results;
  }

  function clone(object) {
    return extend({ }, object);
  }

  function isElement(object) {
    return !!(object && object.nodeType == 1);
  }

  function isArray(object) {
    return _toString.call(object) === ARRAY_CLASS;
  }

  var hasNativeIsArray = (typeof Array.isArray == 'function')
    && Array.isArray([]) && !Array.isArray({});

  if (hasNativeIsArray) {
    isArray = Array.isArray;
  }

  function isHash(object) {
    return object instanceof Hash;
  }

  function isFunction(object) {
    return _toString.call(object) === FUNCTION_CLASS;
  }

  function isString(object) {
    return _toString.call(object) === STRING_CLASS;
  }

  function isNumber(object) {
    return _toString.call(object) === NUMBER_CLASS;
  }

  function isDate(object) {
    return _toString.call(object) === DATE_CLASS;
  }

  function isUndefined(object) {
    return typeof object === "undefined";
  }

  extend(Object, {
    extend:        extend,
    inspect:       inspect,
    toJSON:        NATIVE_JSON_STRINGIFY_SUPPORT ? stringify : toJSON,
    toQueryString: toQueryString,
    toHTML:        toHTML,
    keys:          Object.keys || keys,
    values:        values,
    clone:         clone,
    isElement:     isElement,
    isArray:       isArray,
    isHash:        isHash,
    isFunction:    isFunction,
    isString:      isString,
    isNumber:      isNumber,
    isDate:        isDate,
    isUndefined:   isUndefined
  });
})();
Object.extend(Function.prototype, (function() {
  var slice = Array.prototype.slice;

  function update(array, args) {
    var arrayLength = array.length, length = args.length;
    while (length--) array[arrayLength + length] = args[length];
    return array;
  }

  function merge(array, args) {
    array = slice.call(array, 0);
    return update(array, args);
  }

  function argumentNames() {
    var names = this.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/)[1]
      .replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
      .replace(/\s+/g, '').split(',');
    return names.length == 1 && !names[0] ? [] : names;
  }

  function bind(context) {
    if (arguments.length < 2 && Object.isUndefined(arguments[0])) return this;
    var __method = this, args = slice.call(arguments, 1);
    return function() {
      var a = merge(args, arguments);
      return __method.apply(context, a);
    }
  }

  function bindAsEventListener(context) {
    var __method = this, args = slice.call(arguments, 1);
    return function(event) {
      var a = update([event || window.event], args);
      return __method.apply(context, a);
    }
  }

  function curry() {
    if (!arguments.length) return this;
    var __method = this, args = slice.call(arguments, 0);
    return function() {
      var a = merge(args, arguments);
      return __method.apply(this, a);
    }
  }

  function delay(timeout) {
    var __method = this, args = slice.call(arguments, 1);
    timeout = timeout * 1000;
    return window.setTimeout(function() {
      return __method.apply(__method, args);
    }, timeout);
  }

  function defer() {
    var args = update([0.01], arguments);
    return this.delay.apply(this, args);
  }

  function wrap(wrapper) {
    var __method = this;
    return function() {
      var a = update([__method.bind(this)], arguments);
      return wrapper.apply(this, a);
    }
  }

  function methodize() {
    if (this._methodized) return this._methodized;
    var __method = this;
    return this._methodized = function() {
      var a = update([this], arguments);
      return __method.apply(null, a);
    };
  }

  return {
    argumentNames:       argumentNames,
    bind:                bind,
    bindAsEventListener: bindAsEventListener,
    curry:               curry,
    delay:               delay,
    defer:               defer,
    wrap:                wrap,
    methodize:           methodize
  }
})());



(function(proto) {


  function toISOString() {
    return this.getUTCFullYear() + '-' +
      (this.getUTCMonth() + 1).toPaddedString(2) + '-' +
      this.getUTCDate().toPaddedString(2) + 'T' +
      this.getUTCHours().toPaddedString(2) + ':' +
      this.getUTCMinutes().toPaddedString(2) + ':' +
      this.getUTCSeconds().toPaddedString(2) + 'Z';
  }


  function toJSON() {
    return this.toISOString();
  }

  if (!proto.toISOString) proto.toISOString = toISOString;
  if (!proto.toJSON) proto.toJSON = toJSON;

})(Date.prototype);


RegExp.prototype.match = RegExp.prototype.test;

RegExp.escape = function(str) {
  return String(str).replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
};
var PeriodicalExecuter = Class.create({
  initialize: function(callback, frequency) {
    this.callback = callback;
    this.frequency = frequency;
    this.currentlyExecuting = false;

    this.registerCallback();
  },

  registerCallback: function() {
    this.timer = setInterval(this.onTimerEvent.bind(this), this.frequency * 1000);
  },

  execute: function() {
    this.callback(this);
  },

  stop: function() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  },

  onTimerEvent: function() {
    if (!this.currentlyExecuting) {
      try {
        this.currentlyExecuting = true;
        this.execute();
        this.currentlyExecuting = false;
      } catch(e) {
        this.currentlyExecuting = false;
        throw e;
      }
    }
  }
});
Object.extend(String, {
  interpret: function(value) {
    return value == null ? '' : String(value);
  },
  specialChar: {
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '\\': '\\\\'
  }
});

Object.extend(String.prototype, (function() {
  var NATIVE_JSON_PARSE_SUPPORT = window.JSON &&
    typeof JSON.parse === 'function' &&
    JSON.parse('{"test": true}').test;

  function prepareReplacement(replacement) {
    if (Object.isFunction(replacement)) return replacement;
    var template = new Template(replacement);
    return function(match) { return template.evaluate(match) };
  }

  function gsub(pattern, replacement) {
    var result = '', source = this, match;
    replacement = prepareReplacement(replacement);

    if (Object.isString(pattern))
      pattern = RegExp.escape(pattern);

    if (!(pattern.length || pattern.source)) {
      replacement = replacement('');
      return replacement + source.split('').join(replacement) + replacement;
    }

    while (source.length > 0) {
      if (match = source.match(pattern)) {
        result += source.slice(0, match.index);
        result += String.interpret(replacement(match));
        source  = source.slice(match.index + match[0].length);
      } else {
        result += source, source = '';
      }
    }
    return result;
  }

  function sub(pattern, replacement, count) {
    replacement = prepareReplacement(replacement);
    count = Object.isUndefined(count) ? 1 : count;

    return this.gsub(pattern, function(match) {
      if (--count < 0) return match[0];
      return replacement(match);
    });
  }

  function scan(pattern, iterator) {
    this.gsub(pattern, iterator);
    return String(this);
  }

  function truncate(length, truncation) {
    length = length || 30;
    truncation = Object.isUndefined(truncation) ? '...' : truncation;
    return this.length > length ?
      this.slice(0, length - truncation.length) + truncation : String(this);
  }

  function strip() {
    return this.replace(/^\s+/, '').replace(/\s+$/, '');
  }

  function stripTags() {
    return this.replace(/<\w+(\s+("[^"]*"|'[^']*'|[^>])+)?>|<\/\w+>/gi, '');
  }

  function stripScripts() {
    return this.replace(new RegExp(Prototype.ScriptFragment, 'img'), '');
  }

  function extractScripts() {
    var matchAll = new RegExp(Prototype.ScriptFragment, 'img'),
        matchOne = new RegExp(Prototype.ScriptFragment, 'im');
    return (this.match(matchAll) || []).map(function(scriptTag) {
      return (scriptTag.match(matchOne) || ['', ''])[1];
    });
  }

  function evalScripts() {
    return this.extractScripts().map(function(script) { return eval(script) });
  }

  function escapeHTML() {
    return this.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function unescapeHTML() {
    return this.stripTags().replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  }


  function toQueryParams(separator) {
    var match = this.strip().match(/([^?#]*)(#.*)?$/);
    if (!match) return { };

    return match[1].split(separator || '&').inject({ }, function(hash, pair) {
      if ((pair = pair.split('='))[0]) {
        var key = decodeURIComponent(pair.shift()),
            value = pair.length > 1 ? pair.join('=') : pair[0];

        if (value != undefined) value = decodeURIComponent(value);

        if (key in hash) {
          if (!Object.isArray(hash[key])) hash[key] = [hash[key]];
          hash[key].push(value);
        }
        else hash[key] = value;
      }
      return hash;
    });
  }

  function toArray() {
    return this.split('');
  }

  function succ() {
    return this.slice(0, this.length - 1) +
      String.fromCharCode(this.charCodeAt(this.length - 1) + 1);
  }

  function times(count) {
    return count < 1 ? '' : new Array(count + 1).join(this);
  }

  function camelize() {
    return this.replace(/-+(.)?/g, function(match, chr) {
      return chr ? chr.toUpperCase() : '';
    });
  }

  function capitalize() {
    return this.charAt(0).toUpperCase() + this.substring(1).toLowerCase();
  }

  function underscore() {
    return this.replace(/::/g, '/')
               .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
               .replace(/([a-z\d])([A-Z])/g, '$1_$2')
               .replace(/-/g, '_')
               .toLowerCase();
  }

  function dasherize() {
    return this.replace(/_/g, '-');
  }

  function inspect(useDoubleQuotes) {
    var escapedString = this.replace(/[\x00-\x1f\\]/g, function(character) {
      if (character in String.specialChar) {
        return String.specialChar[character];
      }
      return '\\u00' + character.charCodeAt().toPaddedString(2, 16);
    });
    if (useDoubleQuotes) return '"' + escapedString.replace(/"/g, '\\"') + '"';
    return "'" + escapedString.replace(/'/g, '\\\'') + "'";
  }

  function unfilterJSON(filter) {
    return this.replace(filter || Prototype.JSONFilter, '$1');
  }

  function isJSON() {
    var str = this;
    if (str.blank()) return false;
    str = str.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@');
    str = str.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']');
    str = str.replace(/(?:^|:|,)(?:\s*\[)+/g, '');
    return (/^[\],:{}\s]*$/).test(str);
  }

  function evalJSON(sanitize) {
    var json = this.unfilterJSON(),
        cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
    if (cx.test(json)) {
      json = json.replace(cx, function (a) {
        return '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
      });
    }
    try {
      if (!sanitize || json.isJSON()) return eval('(' + json + ')');
    } catch (e) { }
    throw new SyntaxError('Badly formed JSON string: ' + this.inspect());
  }

  function parseJSON() {
    var json = this.unfilterJSON();
    return JSON.parse(json);
  }

  function include(pattern) {
    return this.indexOf(pattern) > -1;
  }

  function startsWith(pattern) {
    return this.lastIndexOf(pattern, 0) === 0;
  }

  function endsWith(pattern) {
    var d = this.length - pattern.length;
    return d >= 0 && this.indexOf(pattern, d) === d;
  }

  function empty() {
    return this == '';
  }

  function blank() {
    return /^\s*$/.test(this);
  }

  function interpolate(object, pattern) {
    return new Template(this, pattern).evaluate(object);
  }

  return {
    gsub:           gsub,
    sub:            sub,
    scan:           scan,
    truncate:       truncate,
    strip:          String.prototype.trim || strip,
    stripTags:      stripTags,
    stripScripts:   stripScripts,
    extractScripts: extractScripts,
    evalScripts:    evalScripts,
    escapeHTML:     escapeHTML,
    unescapeHTML:   unescapeHTML,
    toQueryParams:  toQueryParams,
    parseQuery:     toQueryParams,
    toArray:        toArray,
    succ:           succ,
    times:          times,
    camelize:       camelize,
    capitalize:     capitalize,
    underscore:     underscore,
    dasherize:      dasherize,
    inspect:        inspect,
    unfilterJSON:   unfilterJSON,
    isJSON:         isJSON,
    evalJSON:       NATIVE_JSON_PARSE_SUPPORT ? parseJSON : evalJSON,
    include:        include,
    startsWith:     startsWith,
    endsWith:       endsWith,
    empty:          empty,
    blank:          blank,
    interpolate:    interpolate
  };
})());

var Template = Class.create({
  initialize: function(template, pattern) {
    this.template = template.toString();
    this.pattern = pattern || Template.Pattern;
  },

  evaluate: function(object) {
    if (object && Object.isFunction(object.toTemplateReplacements))
      object = object.toTemplateReplacements();

    return this.template.gsub(this.pattern, function(match) {
      if (object == null) return (match[1] + '');

      var before = match[1] || '';
      if (before == '\\') return match[2];

      var ctx = object, expr = match[3],
          pattern = /^([^.[]+|\[((?:.*?[^\\])?)\])(\.|\[|$)/;

      match = pattern.exec(expr);
      if (match == null) return before;

      while (match != null) {
        var comp = match[1].startsWith('[') ? match[2].replace(/\\\\]/g, ']') : match[1];
        ctx = ctx[comp];
        if (null == ctx || '' == match[3]) break;
        expr = expr.substring('[' == match[3] ? match[1].length : match[0].length);
        match = pattern.exec(expr);
      }

      return before + String.interpret(ctx);
    });
  }
});
Template.Pattern = /(^|.|\r|\n)(#\{(.*?)\})/;

var $break = { };

var Enumerable = (function() {
  function each(iterator, context) {
    var index = 0;
    try {
      this._each(function(value) {
        iterator.call(context, value, index++);
      });
    } catch (e) {
      if (e != $break) throw e;
    }
    return this;
  }

  function eachSlice(number, iterator, context) {
    var index = -number, slices = [], array = this.toArray();
    if (number < 1) return array;
    while ((index += number) < array.length)
      slices.push(array.slice(index, index+number));
    return slices.collect(iterator, context);
  }

  function all(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = true;
    this.each(function(value, index) {
      result = result && !!iterator.call(context, value, index);
      if (!result) throw $break;
    });
    return result;
  }

  function any(iterator, context) {
    iterator = iterator || Prototype.K;
    var result = false;
    this.each(function(value, index) {
      if (result = !!iterator.call(context, value, index))
        throw $break;
    });
    return result;
  }

  function collect(iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];
    this.each(function(value, index) {
      results.push(iterator.call(context, value, index));
    });
    return results;
  }

  function detect(iterator, context) {
    var result;
    this.each(function(value, index) {
      if (iterator.call(context, value, index)) {
        result = value;
        throw $break;
      }
    });
    return result;
  }

  function findAll(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  }

  function grep(filter, iterator, context) {
    iterator = iterator || Prototype.K;
    var results = [];

    if (Object.isString(filter))
      filter = new RegExp(RegExp.escape(filter));

    this.each(function(value, index) {
      if (filter.match(value))
        results.push(iterator.call(context, value, index));
    });
    return results;
  }

  function include(object) {
    if (Object.isFunction(this.indexOf))
      if (this.indexOf(object) != -1) return true;

    var found = false;
    this.each(function(value) {
      if (value == object) {
        found = true;
        throw $break;
      }
    });
    return found;
  }

  function inGroupsOf(number, fillWith) {
    fillWith = Object.isUndefined(fillWith) ? null : fillWith;
    return this.eachSlice(number, function(slice) {
      while(slice.length < number) slice.push(fillWith);
      return slice;
    });
  }

  function inject(memo, iterator, context) {
    this.each(function(value, index) {
      memo = iterator.call(context, memo, value, index);
    });
    return memo;
  }

  function invoke(method) {
    var args = $A(arguments).slice(1);
    return this.map(function(value) {
      return value[method].apply(value, args);
    });
  }

  function max(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value >= result)
        result = value;
    });
    return result;
  }

  function min(iterator, context) {
    iterator = iterator || Prototype.K;
    var result;
    this.each(function(value, index) {
      value = iterator.call(context, value, index);
      if (result == null || value < result)
        result = value;
    });
    return result;
  }

  function partition(iterator, context) {
    iterator = iterator || Prototype.K;
    var trues = [], falses = [];
    this.each(function(value, index) {
      (iterator.call(context, value, index) ?
        trues : falses).push(value);
    });
    return [trues, falses];
  }

  function pluck(property) {
    var results = [];
    this.each(function(value) {
      results.push(value[property]);
    });
    return results;
  }

  function reject(iterator, context) {
    var results = [];
    this.each(function(value, index) {
      if (!iterator.call(context, value, index))
        results.push(value);
    });
    return results;
  }

  function sortBy(iterator, context) {
    return this.map(function(value, index) {
      return {
        value: value,
        criteria: iterator.call(context, value, index)
      };
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }).pluck('value');
  }

  function toArray() {
    return this.map();
  }

  function zip() {
    var iterator = Prototype.K, args = $A(arguments);
    if (Object.isFunction(args.last()))
      iterator = args.pop();

    var collections = [this].concat(args).map($A);
    return this.map(function(value, index) {
      return iterator(collections.pluck(index));
    });
  }

  function size() {
    return this.toArray().length;
  }

  function inspect() {
    return '#<Enumerable:' + this.toArray().inspect() + '>';
  }









  return {
    each:       each,
    eachSlice:  eachSlice,
    all:        all,
    every:      all,
    any:        any,
    some:       any,
    collect:    collect,
    map:        collect,
    detect:     detect,
    findAll:    findAll,
    select:     findAll,
    filter:     findAll,
    grep:       grep,
    include:    include,
    member:     include,
    inGroupsOf: inGroupsOf,
    inject:     inject,
    invoke:     invoke,
    max:        max,
    min:        min,
    partition:  partition,
    pluck:      pluck,
    reject:     reject,
    sortBy:     sortBy,
    toArray:    toArray,
    entries:    toArray,
    zip:        zip,
    size:       size,
    inspect:    inspect,
    find:       detect
  };
})();

function $A(iterable) {
  if (!iterable) return [];
  if ('toArray' in Object(iterable)) return iterable.toArray();
  var length = iterable.length || 0, results = new Array(length);
  while (length--) results[length] = iterable[length];
  return results;
}


function $w(string) {
  if (!Object.isString(string)) return [];
  string = string.strip();
  return string ? string.split(/\s+/) : [];
}

Array.from = $A;


(function() {
  var arrayProto = Array.prototype,
      slice = arrayProto.slice,
      _each = arrayProto.forEach; // use native browser JS 1.6 implementation if available

  function each(iterator, context) {
    for (var i = 0, length = this.length >>> 0; i < length; i++) {
      if (i in this) iterator.call(context, this[i], i, this);
    }
  }
  if (!_each) _each = each;

  function clear() {
    this.length = 0;
    return this;
  }

  function first() {
    return this[0];
  }

  function last() {
    return this[this.length - 1];
  }

  function compact() {
    return this.select(function(value) {
      return value != null;
    });
  }

  function flatten() {
    return this.inject([], function(array, value) {
      if (Object.isArray(value))
        return array.concat(value.flatten());
      array.push(value);
      return array;
    });
  }

  function without() {
    var values = slice.call(arguments, 0);
    return this.select(function(value) {
      return !values.include(value);
    });
  }

  function reverse(inline) {
    return (inline === false ? this.toArray() : this)._reverse();
  }

  function uniq(sorted) {
    return this.inject([], function(array, value, index) {
      if (0 == index || (sorted ? array.last() != value : !array.include(value)))
        array.push(value);
      return array;
    });
  }

  function intersect(array) {
    return this.uniq().findAll(function(item) {
      return array.detect(function(value) { return item === value });
    });
  }


  function clone() {
    return slice.call(this, 0);
  }

  function size() {
    return this.length;
  }

  function inspect() {
    return '[' + this.map(Object.inspect).join(', ') + ']';
  }

  function indexOf(item, i) {
    i || (i = 0);
    var length = this.length;
    if (i < 0) i = length + i;
    for (; i < length; i++)
      if (this[i] === item) return i;
    return -1;
  }

  function lastIndexOf(item, i) {
    i = isNaN(i) ? this.length : (i < 0 ? this.length + i : i) + 1;
    var n = this.slice(0, i).reverse().indexOf(item);
    return (n < 0) ? n : i - n - 1;
  }

  function concat() {
    var array = slice.call(this, 0), item;
    for (var i = 0, length = arguments.length; i < length; i++) {
      item = arguments[i];
      if (Object.isArray(item) && !('callee' in item)) {
        for (var j = 0, arrayLength = item.length; j < arrayLength; j++)
          array.push(item[j]);
      } else {
        array.push(item);
      }
    }
    return array;
  }

  Object.extend(arrayProto, Enumerable);

  if (!arrayProto._reverse)
    arrayProto._reverse = arrayProto.reverse;

  Object.extend(arrayProto, {
    _each:     _each,
    clear:     clear,
    first:     first,
    last:      last,
    compact:   compact,
    flatten:   flatten,
    without:   without,
    reverse:   reverse,
    uniq:      uniq,
    intersect: intersect,
    clone:     clone,
    toArray:   clone,
    size:      size,
    inspect:   inspect
  });

  var CONCAT_ARGUMENTS_BUGGY = (function() {
    return [].concat(arguments)[0][0] !== 1;
  })(1,2)

  if (CONCAT_ARGUMENTS_BUGGY) arrayProto.concat = concat;

  if (!arrayProto.indexOf) arrayProto.indexOf = indexOf;
  if (!arrayProto.lastIndexOf) arrayProto.lastIndexOf = lastIndexOf;
})();
function $H(object) {
  return new Hash(object);
};

var Hash = Class.create(Enumerable, (function() {
  function initialize(object) {
    this._object = Object.isHash(object) ? object.toObject() : Object.clone(object);
  }


  function _each(iterator) {
    for (var key in this._object) {
      var value = this._object[key], pair = [key, value];
      pair.key = key;
      pair.value = value;
      iterator(pair);
    }
  }

  function set(key, value) {
    return this._object[key] = value;
  }

  function get(key) {
    if (this._object[key] !== Object.prototype[key])
      return this._object[key];
  }

  function unset(key) {
    var value = this._object[key];
    delete this._object[key];
    return value;
  }

  function toObject() {
    return Object.clone(this._object);
  }



  function keys() {
    return this.pluck('key');
  }

  function values() {
    return this.pluck('value');
  }

  function index(value) {
    var match = this.detect(function(pair) {
      return pair.value === value;
    });
    return match && match.key;
  }

  function merge(object) {
    return this.clone().update(object);
  }

  function update(object) {
    return new Hash(object).inject(this, function(result, pair) {
      result.set(pair.key, pair.value);
      return result;
    });
  }

  function toQueryPair(key, value) {
    if (Object.isUndefined(value)) return key;
    return key + '=' + encodeURIComponent(String.interpret(value));
  }

  function toQueryString() {
    return this.inject([], function(results, pair) {
      var key = encodeURIComponent(pair.key), values = pair.value;

      if (values && typeof values == 'object') {
        if (Object.isArray(values)) {
          var queryValues = [];
          for (var i = 0, len = values.length, value; i < len; i++) {
            value = values[i];
            queryValues.push(toQueryPair(key, value));
          }
          return results.concat(queryValues);
        }
      } else results.push(toQueryPair(key, values));
      return results;
    }).join('&');
  }

  function inspect() {
    return '#<Hash:{' + this.map(function(pair) {
      return pair.map(Object.inspect).join(': ');
    }).join(', ') + '}>';
  }

  function clone() {
    return new Hash(this);
  }

  return {
    initialize:             initialize,
    _each:                  _each,
    set:                    set,
    get:                    get,
    unset:                  unset,
    toObject:               toObject,
    toTemplateReplacements: toObject,
    keys:                   keys,
    values:                 values,
    index:                  index,
    merge:                  merge,
    update:                 update,
    toQueryString:          toQueryString,
    inspect:                inspect,
    toJSON:                 toObject,
    clone:                  clone
  };
})());

Hash.from = $H;
Object.extend(Number.prototype, (function() {
  function toColorPart() {
    return this.toPaddedString(2, 16);
  }

  function succ() {
    return this + 1;
  }

  function times(iterator, context) {
    $R(0, this, true).each(iterator, context);
    return this;
  }

  function toPaddedString(length, radix) {
    var string = this.toString(radix || 10);
    return '0'.times(length - string.length) + string;
  }

  function abs() {
    return Math.abs(this);
  }

  function round() {
    return Math.round(this);
  }

  function ceil() {
    return Math.ceil(this);
  }

  function floor() {
    return Math.floor(this);
  }

  return {
    toColorPart:    toColorPart,
    succ:           succ,
    times:          times,
    toPaddedString: toPaddedString,
    abs:            abs,
    round:          round,
    ceil:           ceil,
    floor:          floor
  };
})());

function $R(start, end, exclusive) {
  return new ObjectRange(start, end, exclusive);
}

var ObjectRange = Class.create(Enumerable, (function() {
  function initialize(start, end, exclusive) {
    this.start = start;
    this.end = end;
    this.exclusive = exclusive;
  }

  function _each(iterator) {
    var value = this.start;
    while (this.include(value)) {
      iterator(value);
      value = value.succ();
    }
  }

  function include(value) {
    if (value < this.start)
      return false;
    if (this.exclusive)
      return value < this.end;
    return value <= this.end;
  }

  return {
    initialize: initialize,
    _each:      _each,
    include:    include
  };
})());



var Ajax = {
  getTransport: function() {
    return Try.these(
      function() {return new XMLHttpRequest()},
      function() {return new ActiveXObject('Msxml2.XMLHTTP')},
      function() {return new ActiveXObject('Microsoft.XMLHTTP')}
    ) || false;
  },

  activeRequestCount: 0
};

Ajax.Responders = {
  responders: [],

  _each: function(iterator) {
    this.responders._each(iterator);
  },

  register: function(responder) {
    if (!this.include(responder))
      this.responders.push(responder);
  },

  unregister: function(responder) {
    this.responders = this.responders.without(responder);
  },

  dispatch: function(callback, request, transport, json) {
    this.each(function(responder) {
      if (Object.isFunction(responder[callback])) {
        try {
          responder[callback].apply(responder, [request, transport, json]);
        } catch (e) { }
      }
    });
  }
};

Object.extend(Ajax.Responders, Enumerable);

Ajax.Responders.register({
  onCreate:   function() { Ajax.activeRequestCount++ },
  onComplete: function() { Ajax.activeRequestCount-- }
});
Ajax.Base = Class.create({
  initialize: function(options) {
    this.options = {
      method:       'post',
      asynchronous: true,
      contentType:  'application/x-www-form-urlencoded',
      encoding:     'UTF-8',
      parameters:   '',
      evalJSON:     true,
      evalJS:       true
    };
    Object.extend(this.options, options || { });

    this.options.method = this.options.method.toLowerCase();

    if (Object.isHash(this.options.parameters))
      this.options.parameters = this.options.parameters.toObject();
  }
});
Ajax.Request = Class.create(Ajax.Base, {
  _complete: false,

  initialize: function($super, url, options) {
    $super(options);
    this.transport = Ajax.getTransport();
    this.request(url);
  },

  request: function(url) {
    this.url = url;
    this.method = this.options.method;
    var params = Object.isString(this.options.parameters) ?
          this.options.parameters :
          Object.toQueryString(this.options.parameters);

    if (!['get', 'post'].include(this.method)) {
      params += (params ? '&' : '') + "_method=" + this.method;
      this.method = 'post';
    }

    if (params && this.method === 'get') {
      this.url += (this.url.include('?') ? '&' : '?') + params;
    }

    this.parameters = params.toQueryParams();

    try {
      var response = new Ajax.Response(this);
      if (this.options.onCreate) this.options.onCreate(response);
      Ajax.Responders.dispatch('onCreate', this, response);

      this.transport.open(this.method.toUpperCase(), this.url,
        this.options.asynchronous);

      if (this.options.asynchronous) this.respondToReadyState.bind(this).defer(1);

      this.transport.onreadystatechange = this.onStateChange.bind(this);
      this.setRequestHeaders();

      this.body = this.method == 'post' ? (this.options.postBody || params) : null;
      this.transport.send(this.body);

      /* Force Firefox to handle ready state 4 for synchronous requests */
      if (!this.options.asynchronous && this.transport.overrideMimeType)
        this.onStateChange();

    }
    catch (e) {
      this.dispatchException(e);
    }
  },

  onStateChange: function() {
    var readyState = this.transport.readyState;
    if (readyState > 1 && !((readyState == 4) && this._complete))
      this.respondToReadyState(this.transport.readyState);
  },

  setRequestHeaders: function() {
    var headers = {
      'X-Requested-With': 'XMLHttpRequest',
      'X-Prototype-Version': Prototype.Version,
      'Accept': 'text/javascript, text/html, application/xml, text/xml, */*'
    };

    if (this.method == 'post') {
      headers['Content-type'] = this.options.contentType +
        (this.options.encoding ? '; charset=' + this.options.encoding : '');

      /* Force "Connection: close" for older Mozilla browsers to work
       * around a bug where XMLHttpRequest sends an incorrect
       * Content-length header. See Mozilla Bugzilla #246651.
       */
      if (this.transport.overrideMimeType &&
          (navigator.userAgent.match(/Gecko\/(\d{4})/) || [0,2005])[1] < 2005)
            headers['Connection'] = 'close';
    }

    if (typeof this.options.requestHeaders == 'object') {
      var extras = this.options.requestHeaders;

      if (Object.isFunction(extras.push))
        for (var i = 0, length = extras.length; i < length; i += 2)
          headers[extras[i]] = extras[i+1];
      else
        $H(extras).each(function(pair) { headers[pair.key] = pair.value });
    }

    for (var name in headers)
      this.transport.setRequestHeader(name, headers[name]);
  },

  success: function() {
    var status = this.getStatus();
    return !status || (status >= 200 && status < 300) || status == 304;
  },

  getStatus: function() {
    try {
      if (this.transport.status === 1223) return 204;
      return this.transport.status || 0;
    } catch (e) { return 0 }
  },

  respondToReadyState: function(readyState) {
    var state = Ajax.Request.Events[readyState], response = new Ajax.Response(this);

    if (state == 'Complete') {
      try {
        this._complete = true;
        (this.options['on' + response.status]
         || this.options['on' + (this.success() ? 'Success' : 'Failure')]
         || Prototype.emptyFunction)(response, response.headerJSON);
      } catch (e) {
        this.dispatchException(e);
      }

      var contentType = response.getHeader('Content-type');
      if (this.options.evalJS == 'force'
          || (this.options.evalJS && this.isSameOrigin() && contentType
          && contentType.match(/^\s*(text|application)\/(x-)?(java|ecma)script(;.*)?\s*$/i)))
        this.evalResponse();
    }

    try {
      (this.options['on' + state] || Prototype.emptyFunction)(response, response.headerJSON);
      Ajax.Responders.dispatch('on' + state, this, response, response.headerJSON);
    } catch (e) {
      this.dispatchException(e);
    }

    if (state == 'Complete') {
      this.transport.onreadystatechange = Prototype.emptyFunction;
    }
  },

  isSameOrigin: function() {
    var m = this.url.match(/^\s*https?:\/\/[^\/]*/);
    return !m || (m[0] == '#{protocol}//#{domain}#{port}'.interpolate({
      protocol: location.protocol,
      domain: document.domain,
      port: location.port ? ':' + location.port : ''
    }));
  },

  getHeader: function(name) {
    try {
      return this.transport.getResponseHeader(name) || null;
    } catch (e) { return null; }
  },

  evalResponse: function() {
    try {
      return eval((this.transport.responseText || '').unfilterJSON());
    } catch (e) {
      this.dispatchException(e);
    }
  },

  dispatchException: function(exception) {
    (this.options.onException || Prototype.emptyFunction)(this, exception);
    Ajax.Responders.dispatch('onException', this, exception);
  }
});

Ajax.Request.Events =
  ['Uninitialized', 'Loading', 'Loaded', 'Interactive', 'Complete'];








Ajax.Response = Class.create({
  initialize: function(request){
    this.request = request;
    var transport  = this.transport  = request.transport,
        readyState = this.readyState = transport.readyState;

    if ((readyState > 2 && !Prototype.Browser.IE) || readyState == 4) {
      this.status       = this.getStatus();
      this.statusText   = this.getStatusText();
      this.responseText = String.interpret(transport.responseText);
      this.headerJSON   = this._getHeaderJSON();
    }

    if (readyState == 4) {
      var xml = transport.responseXML;
      this.responseXML  = Object.isUndefined(xml) ? null : xml;
      this.responseJSON = this._getResponseJSON();
    }
  },

  status:      0,

  statusText: '',

  getStatus: Ajax.Request.prototype.getStatus,

  getStatusText: function() {
    try {
      return this.transport.statusText || '';
    } catch (e) { return '' }
  },

  getHeader: Ajax.Request.prototype.getHeader,

  getAllHeaders: function() {
    try {
      return this.getAllResponseHeaders();
    } catch (e) { return null }
  },

  getResponseHeader: function(name) {
    return this.transport.getResponseHeader(name);
  },

  getAllResponseHeaders: function() {
    return this.transport.getAllResponseHeaders();
  },

  _getHeaderJSON: function() {
    var json = this.getHeader('X-JSON');
    if (!json) return null;
    json = decodeURIComponent(escape(json));
    try {
      return json.evalJSON(this.request.options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  },

  _getResponseJSON: function() {
    var options = this.request.options;
    if (!options.evalJSON || (options.evalJSON != 'force' &&
      !(this.getHeader('Content-type') || '').include('application/json')) ||
        this.responseText.blank())
          return null;
    try {
      return this.responseText.evalJSON(options.sanitizeJSON ||
        !this.request.isSameOrigin());
    } catch (e) {
      this.request.dispatchException(e);
    }
  }
});

Ajax.Updater = Class.create(Ajax.Request, {
  initialize: function($super, container, url, options) {
    this.container = {
      success: (container.success || container),
      failure: (container.failure || (container.success ? null : container))
    };

    options = Object.clone(options);
    var onComplete = options.onComplete;
    options.onComplete = (function(response, json) {
      this.updateContent(response.responseText);
      if (Object.isFunction(onComplete)) onComplete(response, json);
    }).bind(this);

    $super(url, options);
  },

  updateContent: function(responseText) {
    var receiver = this.container[this.success() ? 'success' : 'failure'],
        options = this.options;

    if (!options.evalScripts) responseText = responseText.stripScripts();

    if (receiver = $(receiver)) {
      if (options.insertion) {
        if (Object.isString(options.insertion)) {
          var insertion = { }; insertion[options.insertion] = responseText;
          receiver.insert(insertion);
        }
        else options.insertion(receiver, responseText);
      }
      else receiver.update(responseText);
    }
  }
});

Ajax.PeriodicalUpdater = Class.create(Ajax.Base, {
  initialize: function($super, container, url, options) {
    $super(options);
    this.onComplete = this.options.onComplete;

    this.frequency = (this.options.frequency || 2);
    this.decay = (this.options.decay || 1);

    this.updater = { };
    this.container = container;
    this.url = url;

    this.start();
  },

  start: function() {
    this.options.onComplete = this.updateComplete.bind(this);
    this.onTimerEvent();
  },

  stop: function() {
    this.updater.options.onComplete = undefined;
    clearTimeout(this.timer);
    (this.onComplete || Prototype.emptyFunction).apply(this, arguments);
  },

  updateComplete: function(response) {
    if (this.options.decay) {
      this.decay = (response.responseText == this.lastText ?
        this.decay * this.options.decay : 1);

      this.lastText = response.responseText;
    }
    this.timer = this.onTimerEvent.bind(this).delay(this.decay * this.frequency);
  },

  onTimerEvent: function() {
    this.updater = new Ajax.Updater(this.container, this.url, this.options);
  }
});


function $(element) {
  if (arguments.length > 1) {
    for (var i = 0, elements = [], length = arguments.length; i < length; i++)
      elements.push($(arguments[i]));
    return elements;
  }
  if (Object.isString(element))
    element = document.getElementById(element);
  return Element.extend(element);
}

if (Prototype.BrowserFeatures.XPath) {
  document._getElementsByXPath = function(expression, parentElement) {
    var results = [];
    var query = document.evaluate(expression, $(parentElement) || document,
      null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (var i = 0, length = query.snapshotLength; i < length; i++)
      results.push(Element.extend(query.snapshotItem(i)));
    return results;
  };
}

/*--------------------------------------------------------------------------*/

if (!Node) var Node = { };

if (!Node.ELEMENT_NODE) {
  Object.extend(Node, {
    ELEMENT_NODE: 1,
    ATTRIBUTE_NODE: 2,
    TEXT_NODE: 3,
    CDATA_SECTION_NODE: 4,
    ENTITY_REFERENCE_NODE: 5,
    ENTITY_NODE: 6,
    PROCESSING_INSTRUCTION_NODE: 7,
    COMMENT_NODE: 8,
    DOCUMENT_NODE: 9,
    DOCUMENT_TYPE_NODE: 10,
    DOCUMENT_FRAGMENT_NODE: 11,
    NOTATION_NODE: 12
  });
}



(function(global) {
  function shouldUseCache(tagName, attributes) {
    if (tagName === 'select') return false;
    if ('type' in attributes) return false;
    return true;
  }

  var HAS_EXTENDED_CREATE_ELEMENT_SYNTAX = (function(){
    try {
      var el = document.createElement('<input name="x">');
      return el.tagName.toLowerCase() === 'input' && el.name === 'x';
    }
    catch(err) {
      return false;
    }
  })();

  var element = global.Element;

  global.Element = function(tagName, attributes) {
    attributes = attributes || { };
    tagName = tagName.toLowerCase();
    var cache = Element.cache;

    if (HAS_EXTENDED_CREATE_ELEMENT_SYNTAX && attributes.name) {
      tagName = '<' + tagName + ' name="' + attributes.name + '">';
      delete attributes.name;
      return Element.writeAttribute(document.createElement(tagName), attributes);
    }

    if (!cache[tagName]) cache[tagName] = Element.extend(document.createElement(tagName));

    var node = shouldUseCache(tagName, attributes) ?
     cache[tagName].cloneNode(false) : document.createElement(tagName);

    return Element.writeAttribute(node, attributes);
  };

  Object.extend(global.Element, element || { });
  if (element) global.Element.prototype = element.prototype;

})(this);

Element.idCounter = 1;
Element.cache = { };

Element._purgeElement = function(element) {
  var uid = element._prototypeUID;
  if (uid) {
    Element.stopObserving(element);
    element._prototypeUID = void 0;
    delete Element.Storage[uid];
  }
}

Element.Methods = {
  visible: function(element) {
    return $(element).style.display != 'none';
  },

  toggle: function(element) {
    element = $(element);
    Element[Element.visible(element) ? 'hide' : 'show'](element);
    return element;
  },

  hide: function(element) {
    element = $(element);
    element.style.display = 'none';
    return element;
  },

  show: function(element) {
    element = $(element);
    element.style.display = '';
    return element;
  },

  remove: function(element) {
    element = $(element);
    element.parentNode.removeChild(element);
    return element;
  },

  update: (function(){

    var SELECT_ELEMENT_INNERHTML_BUGGY = (function(){
      var el = document.createElement("select"),
          isBuggy = true;
      el.innerHTML = "<option value=\"test\">test</option>";
      if (el.options && el.options[0]) {
        isBuggy = el.options[0].nodeName.toUpperCase() !== "OPTION";
      }
      el = null;
      return isBuggy;
    })();

    var TABLE_ELEMENT_INNERHTML_BUGGY = (function(){
      try {
        var el = document.createElement("table");
        if (el && el.tBodies) {
          el.innerHTML = "<tbody><tr><td>test</td></tr></tbody>";
          var isBuggy = typeof el.tBodies[0] == "undefined";
          el = null;
          return isBuggy;
        }
      } catch (e) {
        return true;
      }
    })();

    var LINK_ELEMENT_INNERHTML_BUGGY = (function() {
      try {
        var el = document.createElement('div');
        el.innerHTML = "<link>";
        var isBuggy = (el.childNodes.length === 0);
        el = null;
        return isBuggy;
      } catch(e) {
        return true;
      }
    })();

    var ANY_INNERHTML_BUGGY = SELECT_ELEMENT_INNERHTML_BUGGY ||
     TABLE_ELEMENT_INNERHTML_BUGGY || LINK_ELEMENT_INNERHTML_BUGGY;

    var SCRIPT_ELEMENT_REJECTS_TEXTNODE_APPENDING = (function () {
      var s = document.createElement("script"),
          isBuggy = false;
      try {
        s.appendChild(document.createTextNode(""));
        isBuggy = !s.firstChild ||
          s.firstChild && s.firstChild.nodeType !== 3;
      } catch (e) {
        isBuggy = true;
      }
      s = null;
      return isBuggy;
    })();


    function update(element, content) {
      element = $(element);
      var purgeElement = Element._purgeElement;

      var descendants = element.getElementsByTagName('*'),
       i = descendants.length;
      while (i--) purgeElement(descendants[i]);

      if (content && content.toElement)
        content = content.toElement();

      if (Object.isElement(content))
        return element.update().insert(content);

      content = Object.toHTML(content);

      var tagName = element.tagName.toUpperCase();

      if (tagName === 'SCRIPT' && SCRIPT_ELEMENT_REJECTS_TEXTNODE_APPENDING) {
        element.text = content;
        return element;
      }

      if (ANY_INNERHTML_BUGGY) {
        if (tagName in Element._insertionTranslations.tags) {
          while (element.firstChild) {
            element.removeChild(element.firstChild);
          }
          Element._getContentFromAnonymousElement(tagName, content.stripScripts())
            .each(function(node) {
              element.appendChild(node)
            });
        } else if (LINK_ELEMENT_INNERHTML_BUGGY && Object.isString(content) && content.indexOf('<link') > -1) {
          while (element.firstChild) {
            element.removeChild(element.firstChild);
          }
          var nodes = Element._getContentFromAnonymousElement(tagName, content.stripScripts(), true);
          nodes.each(function(node) { element.appendChild(node) });
        }
        else {
          element.innerHTML = content.stripScripts();
        }
      }
      else {
        element.innerHTML = content.stripScripts();
      }

      content.evalScripts.bind(content).defer();
      return element;
    }

    return update;
  })(),

  replace: function(element, content) {
    element = $(element);
    if (content && content.toElement) content = content.toElement();
    else if (!Object.isElement(content)) {
      content = Object.toHTML(content);
      var range = element.ownerDocument.createRange();
      range.selectNode(element);
      content.evalScripts.bind(content).defer();
      content = range.createContextualFragment(content.stripScripts());
    }
    element.parentNode.replaceChild(content, element);
    return element;
  },

  insert: function(element, insertions) {
    element = $(element);

    if (Object.isString(insertions) || Object.isNumber(insertions) ||
        Object.isElement(insertions) || (insertions && (insertions.toElement || insertions.toHTML)))
          insertions = {bottom:insertions};

    var content, insert, tagName, childNodes;

    for (var position in insertions) {
      content  = insertions[position];
      position = position.toLowerCase();
      insert = Element._insertionTranslations[position];

      if (content && content.toElement) content = content.toElement();
      if (Object.isElement(content)) {
        insert(element, content);
        continue;
      }

      content = Object.toHTML(content);

      tagName = ((position == 'before' || position == 'after')
        ? element.parentNode : element).tagName.toUpperCase();

      childNodes = Element._getContentFromAnonymousElement(tagName, content.stripScripts());

      if (position == 'top' || position == 'after') childNodes.reverse();
      childNodes.each(insert.curry(element));

      content.evalScripts.bind(content).defer();
    }

    return element;
  },

  wrap: function(element, wrapper, attributes) {
    element = $(element);
    if (Object.isElement(wrapper))
      $(wrapper).writeAttribute(attributes || { });
    else if (Object.isString(wrapper)) wrapper = new Element(wrapper, attributes);
    else wrapper = new Element('div', wrapper);
    if (element.parentNode)
      element.parentNode.replaceChild(wrapper, element);
    wrapper.appendChild(element);
    return wrapper;
  },

  inspect: function(element) {
    element = $(element);
    var result = '<' + element.tagName.toLowerCase();
    $H({'id': 'id', 'className': 'class'}).each(function(pair) {
      var property = pair.first(),
          attribute = pair.last(),
          value = (element[property] || '').toString();
      if (value) result += ' ' + attribute + '=' + value.inspect(true);
    });
    return result + '>';
  },

  recursivelyCollect: function(element, property, maximumLength) {
    element = $(element);
    maximumLength = maximumLength || -1;
    var elements = [];

    while (element = element[property]) {
      if (element.nodeType == 1)
        elements.push(Element.extend(element));
      if (elements.length == maximumLength)
        break;
    }

    return elements;
  },

  ancestors: function(element) {
    return Element.recursivelyCollect(element, 'parentNode');
  },

  descendants: function(element) {
    return Element.select(element, "*");
  },

  firstDescendant: function(element) {
    element = $(element).firstChild;
    while (element && element.nodeType != 1) element = element.nextSibling;
    return $(element);
  },

  immediateDescendants: function(element) {
    var results = [], child = $(element).firstChild;
    while (child) {
      if (child.nodeType === 1) {
        results.push(Element.extend(child));
      }
      child = child.nextSibling;
    }
    return results;
  },

  previousSiblings: function(element, maximumLength) {
    return Element.recursivelyCollect(element, 'previousSibling');
  },

  nextSiblings: function(element) {
    return Element.recursivelyCollect(element, 'nextSibling');
  },

  siblings: function(element) {
    element = $(element);
    return Element.previousSiblings(element).reverse()
      .concat(Element.nextSiblings(element));
  },

  match: function(element, selector) {
    element = $(element);
    if (Object.isString(selector))
      return Prototype.Selector.match(element, selector);
    return selector.match(element);
  },

  up: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return $(element.parentNode);
    var ancestors = Element.ancestors(element);
    return Object.isNumber(expression) ? ancestors[expression] :
      Prototype.Selector.find(ancestors, expression, index);
  },

  down: function(element, expression, index) {
    element = $(element);
    if (arguments.length == 1) return Element.firstDescendant(element);
    return Object.isNumber(expression) ? Element.descendants(element)[expression] :
      Element.select(element, expression)[index || 0];
  },

  previous: function(element, expression, index) {
    element = $(element);
    if (Object.isNumber(expression)) index = expression, expression = false;
    if (!Object.isNumber(index)) index = 0;

    if (expression) {
      return Prototype.Selector.find(element.previousSiblings(), expression, index);
    } else {
      return element.recursivelyCollect("previousSibling", index + 1)[index];
    }
  },

  next: function(element, expression, index) {
    element = $(element);
    if (Object.isNumber(expression)) index = expression, expression = false;
    if (!Object.isNumber(index)) index = 0;

    if (expression) {
      return Prototype.Selector.find(element.nextSiblings(), expression, index);
    } else {
      var maximumLength = Object.isNumber(index) ? index + 1 : 1;
      return element.recursivelyCollect("nextSibling", index + 1)[index];
    }
  },


  select: function(element) {
    element = $(element);
    var expressions = Array.prototype.slice.call(arguments, 1).join(', ');
    return Prototype.Selector.select(expressions, element);
  },

  adjacent: function(element) {
    element = $(element);
    var expressions = Array.prototype.slice.call(arguments, 1).join(', ');
    return Prototype.Selector.select(expressions, element.parentNode).without(element);
  },

  identify: function(element) {
    element = $(element);
    var id = Element.readAttribute(element, 'id');
    if (id) return id;
    do { id = 'anonymous_element_' + Element.idCounter++ } while ($(id));
    Element.writeAttribute(element, 'id', id);
    return id;
  },

  readAttribute: function(element, name) {
    element = $(element);
    if (Prototype.Browser.IE) {
      var t = Element._attributeTranslations.read;
      if (t.values[name]) return t.values[name](element, name);
      if (t.names[name]) name = t.names[name];
      if (name.include(':')) {
        return (!element.attributes || !element.attributes[name]) ? null :
         element.attributes[name].value;
      }
    }
    return element.getAttribute(name);
  },

  writeAttribute: function(element, name, value) {
    element = $(element);
    var attributes = { }, t = Element._attributeTranslations.write;

    if (typeof name == 'object') attributes = name;
    else attributes[name] = Object.isUndefined(value) ? true : value;

    for (var attr in attributes) {
      name = t.names[attr] || attr;
      value = attributes[attr];
      if (t.values[attr]) name = t.values[attr](element, value);
      if (value === false || value === null)
        element.removeAttribute(name);
      else if (value === true)
        element.setAttribute(name, name);
      else element.setAttribute(name, value);
    }
    return element;
  },

  getHeight: function(element) {
    return Element.getDimensions(element).height;
  },

  getWidth: function(element) {
    return Element.getDimensions(element).width;
  },

  classNames: function(element) {
    return new Element.ClassNames(element);
  },

  hasClassName: function(element, className) {
    if (!(element = $(element))) return;
    var elementClassName = element.className;
    return (elementClassName.length > 0 && (elementClassName == className ||
      new RegExp("(^|\\s)" + className + "(\\s|$)").test(elementClassName)));
  },

  addClassName: function(element, className) {
    if (!(element = $(element))) return;
    if (!Element.hasClassName(element, className))
      element.className += (element.className ? ' ' : '') + className;
    return element;
  },

  removeClassName: function(element, className) {
    if (!(element = $(element))) return;
    element.className = element.className.replace(
      new RegExp("(^|\\s+)" + className + "(\\s+|$)"), ' ').strip();
    return element;
  },

  toggleClassName: function(element, className) {
    if (!(element = $(element))) return;
    return Element[Element.hasClassName(element, className) ?
      'removeClassName' : 'addClassName'](element, className);
  },

  cleanWhitespace: function(element) {
    element = $(element);
    var node = element.firstChild;
    while (node) {
      var nextNode = node.nextSibling;
      if (node.nodeType == 3 && !/\S/.test(node.nodeValue))
        element.removeChild(node);
      node = nextNode;
    }
    return element;
  },

  empty: function(element) {
    return $(element).innerHTML.blank();
  },

  descendantOf: function(element, ancestor) {
    element = $(element), ancestor = $(ancestor);

    if (element.compareDocumentPosition)
      return (element.compareDocumentPosition(ancestor) & 8) === 8;

    if (ancestor.contains)
      return ancestor.contains(element) && ancestor !== element;

    while (element = element.parentNode)
      if (element == ancestor) return true;

    return false;
  },

  scrollTo: function(element) {
    element = $(element);
    var pos = Element.cumulativeOffset(element);
    window.scrollTo(pos[0], pos[1]);
    return element;
  },

  getStyle: function(element, style) {
    element = $(element);
    style = style == 'float' ? 'cssFloat' : style.camelize();
    var value = element.style[style];
    if (!value || value == 'auto') {
      var css = document.defaultView.getComputedStyle(element, null);
      value = css ? css[style] : null;
    }
    if (style == 'opacity') return value ? parseFloat(value) : 1.0;
    return value == 'auto' ? null : value;
  },

  getOpacity: function(element) {
    return $(element).getStyle('opacity');
  },

  setStyle: function(element, styles) {
    element = $(element);
    var elementStyle = element.style, match;
    if (Object.isString(styles)) {
      element.style.cssText += ';' + styles;
      return styles.include('opacity') ?
        element.setOpacity(styles.match(/opacity:\s*(\d?\.?\d*)/)[1]) : element;
    }
    for (var property in styles)
      if (property == 'opacity') element.setOpacity(styles[property]);
      else
        elementStyle[(property == 'float' || property == 'cssFloat') ?
          (Object.isUndefined(elementStyle.styleFloat) ? 'cssFloat' : 'styleFloat') :
            property] = styles[property];

    return element;
  },

  setOpacity: function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;
    return element;
  },

  makePositioned: function(element) {
    element = $(element);
    var pos = Element.getStyle(element, 'position');
    if (pos == 'static' || !pos) {
      element._madePositioned = true;
      element.style.position = 'relative';
      if (Prototype.Browser.Opera) {
        element.style.top = 0;
        element.style.left = 0;
      }
    }
    return element;
  },

  undoPositioned: function(element) {
    element = $(element);
    if (element._madePositioned) {
      element._madePositioned = undefined;
      element.style.position =
        element.style.top =
        element.style.left =
        element.style.bottom =
        element.style.right = '';
    }
    return element;
  },

  makeClipping: function(element) {
    element = $(element);
    if (element._overflow) return element;
    element._overflow = Element.getStyle(element, 'overflow') || 'auto';
    if (element._overflow !== 'hidden')
      element.style.overflow = 'hidden';
    return element;
  },

  undoClipping: function(element) {
    element = $(element);
    if (!element._overflow) return element;
    element.style.overflow = element._overflow == 'auto' ? '' : element._overflow;
    element._overflow = null;
    return element;
  },

  clonePosition: function(element, source) {
    var options = Object.extend({
      setLeft:    true,
      setTop:     true,
      setWidth:   true,
      setHeight:  true,
      offsetTop:  0,
      offsetLeft: 0
    }, arguments[2] || { });

    source = $(source);
    var p = Element.viewportOffset(source), delta = [0, 0], parent = null;

    element = $(element);

    if (Element.getStyle(element, 'position') == 'absolute') {
      parent = Element.getOffsetParent(element);
      delta = Element.viewportOffset(parent);
    }

    if (parent == document.body) {
      delta[0] -= document.body.offsetLeft;
      delta[1] -= document.body.offsetTop;
    }

    if (options.setLeft)   element.style.left  = (p[0] - delta[0] + options.offsetLeft) + 'px';
    if (options.setTop)    element.style.top   = (p[1] - delta[1] + options.offsetTop) + 'px';
    if (options.setWidth)  element.style.width = source.offsetWidth + 'px';
    if (options.setHeight) element.style.height = source.offsetHeight + 'px';
    return element;
  }
};

Object.extend(Element.Methods, {
  getElementsBySelector: Element.Methods.select,

  childElements: Element.Methods.immediateDescendants
});

Element._attributeTranslations = {
  write: {
    names: {
      className: 'class',
      htmlFor:   'for'
    },
    values: { }
  }
};

if (Prototype.Browser.Opera) {
  Element.Methods.getStyle = Element.Methods.getStyle.wrap(
    function(proceed, element, style) {
      switch (style) {
        case 'height': case 'width':
          if (!Element.visible(element)) return null;

          var dim = parseInt(proceed(element, style), 10);

          if (dim !== element['offset' + style.capitalize()])
            return dim + 'px';

          var properties;
          if (style === 'height') {
            properties = ['border-top-width', 'padding-top',
             'padding-bottom', 'border-bottom-width'];
          }
          else {
            properties = ['border-left-width', 'padding-left',
             'padding-right', 'border-right-width'];
          }
          return properties.inject(dim, function(memo, property) {
            var val = proceed(element, property);
            return val === null ? memo : memo - parseInt(val, 10);
          }) + 'px';
        default: return proceed(element, style);
      }
    }
  );

  Element.Methods.readAttribute = Element.Methods.readAttribute.wrap(
    function(proceed, element, attribute) {
      if (attribute === 'title') return element.title;
      return proceed(element, attribute);
    }
  );
}

else if (Prototype.Browser.IE) {
  Element.Methods.getStyle = function(element, style) {
    element = $(element);
    style = (style == 'float' || style == 'cssFloat') ? 'styleFloat' : style.camelize();
    var value = element.style[style];
    if (!value && element.currentStyle) value = element.currentStyle[style];

    if (style == 'opacity') {
      if (value = (element.getStyle('filter') || '').match(/alpha\(opacity=(.*)\)/))
        if (value[1]) return parseFloat(value[1]) / 100;
      return 1.0;
    }

    if (value == 'auto') {
      if ((style == 'width' || style == 'height') && (element.getStyle('display') != 'none'))
        return element['offset' + style.capitalize()] + 'px';
      return null;
    }
    return value;
  };

  Element.Methods.setOpacity = function(element, value) {
    function stripAlpha(filter){
      return filter.replace(/alpha\([^\)]*\)/gi,'');
    }
    element = $(element);
    var currentStyle = element.currentStyle;
    if ((currentStyle && !currentStyle.hasLayout) ||
      (!currentStyle && element.style.zoom == 'normal'))
        element.style.zoom = 1;

    var filter = element.getStyle('filter'), style = element.style;
    if (value == 1 || value === '') {
      (filter = stripAlpha(filter)) ?
        style.filter = filter : style.removeAttribute('filter');
      return element;
    } else if (value < 0.00001) value = 0;
    style.filter = stripAlpha(filter) +
      'alpha(opacity=' + (value * 100) + ')';
    return element;
  };

  Element._attributeTranslations = (function(){

    var classProp = 'className',
        forProp = 'for',
        el = document.createElement('div');

    el.setAttribute(classProp, 'x');

    if (el.className !== 'x') {
      el.setAttribute('class', 'x');
      if (el.className === 'x') {
        classProp = 'class';
      }
    }
    el = null;

    el = document.createElement('label');
    el.setAttribute(forProp, 'x');
    if (el.htmlFor !== 'x') {
      el.setAttribute('htmlFor', 'x');
      if (el.htmlFor === 'x') {
        forProp = 'htmlFor';
      }
    }
    el = null;

    return {
      read: {
        names: {
          'class':      classProp,
          'className':  classProp,
          'for':        forProp,
          'htmlFor':    forProp
        },
        values: {
          _getAttr: function(element, attribute) {
            return element.getAttribute(attribute);
          },
          _getAttr2: function(element, attribute) {
            return element.getAttribute(attribute, 2);
          },
          _getAttrNode: function(element, attribute) {
            var node = element.getAttributeNode(attribute);
            return node ? node.value : "";
          },
          _getEv: (function(){

            var el = document.createElement('div'), f;
            el.onclick = Prototype.emptyFunction;
            var value = el.getAttribute('onclick');

            if (String(value).indexOf('{') > -1) {
              f = function(element, attribute) {
                attribute = element.getAttribute(attribute);
                if (!attribute) return null;
                attribute = attribute.toString();
                attribute = attribute.split('{')[1];
                attribute = attribute.split('}')[0];
                return attribute.strip();
              };
            }
            else if (value === '') {
              f = function(element, attribute) {
                attribute = element.getAttribute(attribute);
                if (!attribute) return null;
                return attribute.strip();
              };
            }
            el = null;
            return f;
          })(),
          _flag: function(element, attribute) {
            return $(element).hasAttribute(attribute) ? attribute : null;
          },
          style: function(element) {
            return element.style.cssText.toLowerCase();
          },
          title: function(element) {
            return element.title;
          }
        }
      }
    }
  })();

  Element._attributeTranslations.write = {
    names: Object.extend({
      cellpadding: 'cellPadding',
      cellspacing: 'cellSpacing'
    }, Element._attributeTranslations.read.names),
    values: {
      checked: function(element, value) {
        element.checked = !!value;
      },

      style: function(element, value) {
        element.style.cssText = value ? value : '';
      }
    }
  };

  Element._attributeTranslations.has = {};

  $w('colSpan rowSpan vAlign dateTime accessKey tabIndex ' +
      'encType maxLength readOnly longDesc frameBorder').each(function(attr) {
    Element._attributeTranslations.write.names[attr.toLowerCase()] = attr;
    Element._attributeTranslations.has[attr.toLowerCase()] = attr;
  });

  (function(v) {
    Object.extend(v, {
      href:        v._getAttr2,
      src:         v._getAttr2,
      type:        v._getAttr,
      action:      v._getAttrNode,
      disabled:    v._flag,
      checked:     v._flag,
      readonly:    v._flag,
      multiple:    v._flag,
      onload:      v._getEv,
      onunload:    v._getEv,
      onclick:     v._getEv,
      ondblclick:  v._getEv,
      onmousedown: v._getEv,
      onmouseup:   v._getEv,
      onmouseover: v._getEv,
      onmousemove: v._getEv,
      onmouseout:  v._getEv,
      onfocus:     v._getEv,
      onblur:      v._getEv,
      onkeypress:  v._getEv,
      onkeydown:   v._getEv,
      onkeyup:     v._getEv,
      onsubmit:    v._getEv,
      onreset:     v._getEv,
      onselect:    v._getEv,
      onchange:    v._getEv
    });
  })(Element._attributeTranslations.read.values);

  if (Prototype.BrowserFeatures.ElementExtensions) {
    (function() {
      function _descendants(element) {
        var nodes = element.getElementsByTagName('*'), results = [];
        for (var i = 0, node; node = nodes[i]; i++)
          if (node.tagName !== "!") // Filter out comment nodes.
            results.push(node);
        return results;
      }

      Element.Methods.down = function(element, expression, index) {
        element = $(element);
        if (arguments.length == 1) return element.firstDescendant();
        return Object.isNumber(expression) ? _descendants(element)[expression] :
          Element.select(element, expression)[index || 0];
      }
    })();
  }

}

else if (Prototype.Browser.Gecko && /rv:1\.8\.0/.test(navigator.userAgent)) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1) ? 0.999999 :
      (value === '') ? '' : (value < 0.00001) ? 0 : value;
    return element;
  };
}

else if (Prototype.Browser.WebKit) {
  Element.Methods.setOpacity = function(element, value) {
    element = $(element);
    element.style.opacity = (value == 1 || value === '') ? '' :
      (value < 0.00001) ? 0 : value;

    if (value == 1)
      if (element.tagName.toUpperCase() == 'IMG' && element.width) {
        element.width++; element.width--;
      } else try {
        var n = document.createTextNode(' ');
        element.appendChild(n);
        element.removeChild(n);
      } catch (e) { }

    return element;
  };
}

if ('outerHTML' in document.documentElement) {
  Element.Methods.replace = function(element, content) {
    element = $(element);

    if (content && content.toElement) content = content.toElement();
    if (Object.isElement(content)) {
      element.parentNode.replaceChild(content, element);
      return element;
    }

    content = Object.toHTML(content);
    var parent = element.parentNode, tagName = parent.tagName.toUpperCase();

    if (Element._insertionTranslations.tags[tagName]) {
      var nextSibling = element.next(),
          fragments = Element._getContentFromAnonymousElement(tagName, content.stripScripts());
      parent.removeChild(element);
      if (nextSibling)
        fragments.each(function(node) { parent.insertBefore(node, nextSibling) });
      else
        fragments.each(function(node) { parent.appendChild(node) });
    }
    else element.outerHTML = content.stripScripts();

    content.evalScripts.bind(content).defer();
    return element;
  };
}

Element._returnOffset = function(l, t) {
  var result = [l, t];
  result.left = l;
  result.top = t;
  return result;
};

Element._getContentFromAnonymousElement = function(tagName, html, force) {
  var div = new Element('div'),
      t = Element._insertionTranslations.tags[tagName];

  var workaround = false;
  if (t) workaround = true;
  else if (force) {
    workaround = true;
    t = ['', '', 0];
  }

  if (workaround) {
    div.innerHTML = '&nbsp;' + t[0] + html + t[1];
    div.removeChild(div.firstChild);
    for (var i = t[2]; i--; ) {
      div = div.firstChild;
    }
  }
  else {
    div.innerHTML = html;
  }
  return $A(div.childNodes);
};

Element._insertionTranslations = {
  before: function(element, node) {
    element.parentNode.insertBefore(node, element);
  },
  top: function(element, node) {
    element.insertBefore(node, element.firstChild);
  },
  bottom: function(element, node) {
    element.appendChild(node);
  },
  after: function(element, node) {
    element.parentNode.insertBefore(node, element.nextSibling);
  },
  tags: {
    TABLE:  ['<table>',                '</table>',                   1],
    TBODY:  ['<table><tbody>',         '</tbody></table>',           2],
    TR:     ['<table><tbody><tr>',     '</tr></tbody></table>',      3],
    TD:     ['<table><tbody><tr><td>', '</td></tr></tbody></table>', 4],
    SELECT: ['<select>',               '</select>',                  1]
  }
};

(function() {
  var tags = Element._insertionTranslations.tags;
  Object.extend(tags, {
    THEAD: tags.TBODY,
    TFOOT: tags.TBODY,
    TH:    tags.TD
  });
})();

Element.Methods.Simulated = {
  hasAttribute: function(element, attribute) {
    attribute = Element._attributeTranslations.has[attribute] || attribute;
    var node = $(element).getAttributeNode(attribute);
    return !!(node && node.specified);
  }
};

Element.Methods.ByTag = { };

Object.extend(Element, Element.Methods);

(function(div) {

  if (!Prototype.BrowserFeatures.ElementExtensions && div['__proto__']) {
    window.HTMLElement = { };
    window.HTMLElement.prototype = div['__proto__'];
    Prototype.BrowserFeatures.ElementExtensions = true;
  }

  div = null;

})(document.createElement('div'));

Element.extend = (function() {

  function checkDeficiency(tagName) {
    if (typeof window.Element != 'undefined') {
      var proto = window.Element.prototype;
      if (proto) {
        var id = '_' + (Math.random()+'').slice(2),
            el = document.createElement(tagName);
        proto[id] = 'x';
        var isBuggy = (el[id] !== 'x');
        delete proto[id];
        el = null;
        return isBuggy;
      }
    }
    return false;
  }

  function extendElementWith(element, methods) {
    for (var property in methods) {
      var value = methods[property];
      if (Object.isFunction(value) && !(property in element))
        element[property] = value.methodize();
    }
  }

  var HTMLOBJECTELEMENT_PROTOTYPE_BUGGY = checkDeficiency('object');

  if (Prototype.BrowserFeatures.SpecificElementExtensions) {
    if (HTMLOBJECTELEMENT_PROTOTYPE_BUGGY) {
      return function(element) {
        if (element && typeof element._extendedByPrototype == 'undefined') {
          var t = element.tagName;
          if (t && (/^(?:object|applet|embed)$/i.test(t))) {
            extendElementWith(element, Element.Methods);
            extendElementWith(element, Element.Methods.Simulated);
            extendElementWith(element, Element.Methods.ByTag[t.toUpperCase()]);
          }
        }
        return element;
      }
    }
    return Prototype.K;
  }

  var Methods = { }, ByTag = Element.Methods.ByTag;

  var extend = Object.extend(function(element) {
    if (!element || typeof element._extendedByPrototype != 'undefined' ||
        element.nodeType != 1 || element == window) return element;

    var methods = Object.clone(Methods),
        tagName = element.tagName.toUpperCase();

    if (ByTag[tagName]) Object.extend(methods, ByTag[tagName]);

    extendElementWith(element, methods);

    element._extendedByPrototype = Prototype.emptyFunction;
    return element;

  }, {
    refresh: function() {
      if (!Prototype.BrowserFeatures.ElementExtensions) {
        Object.extend(Methods, Element.Methods);
        Object.extend(Methods, Element.Methods.Simulated);
      }
    }
  });

  extend.refresh();
  return extend;
})();

if (document.documentElement.hasAttribute) {
  Element.hasAttribute = function(element, attribute) {
    return element.hasAttribute(attribute);
  };
}
else {
  Element.hasAttribute = Element.Methods.Simulated.hasAttribute;
}

Element.addMethods = function(methods) {
  var F = Prototype.BrowserFeatures, T = Element.Methods.ByTag;

  if (!methods) {
    Object.extend(Form, Form.Methods);
    Object.extend(Form.Element, Form.Element.Methods);
    Object.extend(Element.Methods.ByTag, {
      "FORM":     Object.clone(Form.Methods),
      "INPUT":    Object.clone(Form.Element.Methods),
      "SELECT":   Object.clone(Form.Element.Methods),
      "TEXTAREA": Object.clone(Form.Element.Methods),
      "BUTTON":   Object.clone(Form.Element.Methods)
    });
  }

  if (arguments.length == 2) {
    var tagName = methods;
    methods = arguments[1];
  }

  if (!tagName) Object.extend(Element.Methods, methods || { });
  else {
    if (Object.isArray(tagName)) tagName.each(extend);
    else extend(tagName);
  }

  function extend(tagName) {
    tagName = tagName.toUpperCase();
    if (!Element.Methods.ByTag[tagName])
      Element.Methods.ByTag[tagName] = { };
    Object.extend(Element.Methods.ByTag[tagName], methods);
  }

  function copy(methods, destination, onlyIfAbsent) {
    onlyIfAbsent = onlyIfAbsent || false;
    for (var property in methods) {
      var value = methods[property];
      if (!Object.isFunction(value)) continue;
      if (!onlyIfAbsent || !(property in destination))
        destination[property] = value.methodize();
    }
  }

  function findDOMClass(tagName) {
    var klass;
    var trans = {
      "OPTGROUP": "OptGroup", "TEXTAREA": "TextArea", "P": "Paragraph",
      "FIELDSET": "FieldSet", "UL": "UList", "OL": "OList", "DL": "DList",
      "DIR": "Directory", "H1": "Heading", "H2": "Heading", "H3": "Heading",
      "H4": "Heading", "H5": "Heading", "H6": "Heading", "Q": "Quote",
      "INS": "Mod", "DEL": "Mod", "A": "Anchor", "IMG": "Image", "CAPTION":
      "TableCaption", "COL": "TableCol", "COLGROUP": "TableCol", "THEAD":
      "TableSection", "TFOOT": "TableSection", "TBODY": "TableSection", "TR":
      "TableRow", "TH": "TableCell", "TD": "TableCell", "FRAMESET":
      "FrameSet", "IFRAME": "IFrame"
    };
    if (trans[tagName]) klass = 'HTML' + trans[tagName] + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName + 'Element';
    if (window[klass]) return window[klass];
    klass = 'HTML' + tagName.capitalize() + 'Element';
    if (window[klass]) return window[klass];

    var element = document.createElement(tagName),
        proto = element['__proto__'] || element.constructor.prototype;

    element = null;
    return proto;
  }

  var elementPrototype = window.HTMLElement ? HTMLElement.prototype :
   Element.prototype;

  if (F.ElementExtensions) {
    copy(Element.Methods, elementPrototype);
    copy(Element.Methods.Simulated, elementPrototype, true);
  }

  if (F.SpecificElementExtensions) {
    for (var tag in Element.Methods.ByTag) {
      var klass = findDOMClass(tag);
      if (Object.isUndefined(klass)) continue;
      copy(T[tag], klass.prototype);
    }
  }

  Object.extend(Element, Element.Methods);
  delete Element.ByTag;

  if (Element.extend.refresh) Element.extend.refresh();
  Element.cache = { };
};


document.viewport = {

  getDimensions: function() {
    return { width: this.getWidth(), height: this.getHeight() };
  },

  getScrollOffsets: function() {
    return Element._returnOffset(
      window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft,
      window.pageYOffset || document.documentElement.scrollTop  || document.body.scrollTop);
  }
};

(function(viewport) {
  var B = Prototype.Browser, doc = document, element, property = {};

  function getRootElement() {
    if (B.WebKit && !doc.evaluate)
      return document;

    if (B.Opera && window.parseFloat(window.opera.version()) < 9.5)
      return document.body;

    return document.documentElement;
  }

  function define(D) {
    if (!element) element = getRootElement();

    property[D] = 'client' + D;

    viewport['get' + D] = function() { return element[property[D]] };
    return viewport['get' + D]();
  }

  viewport.getWidth  = define.curry('Width');

  viewport.getHeight = define.curry('Height');
})(document.viewport);


Element.Storage = {
  UID: 1
};

Element.addMethods({
  getStorage: function(element) {
    if (!(element = $(element))) return;

    var uid;
    if (element === window) {
      uid = 0;
    } else {
      if (typeof element._prototypeUID === "undefined")
        element._prototypeUID = Element.Storage.UID++;
      uid = element._prototypeUID;
    }

    if (!Element.Storage[uid])
      Element.Storage[uid] = $H();

    return Element.Storage[uid];
  },

  store: function(element, key, value) {
    if (!(element = $(element))) return;

    if (arguments.length === 2) {
      Element.getStorage(element).update(key);
    } else {
      Element.getStorage(element).set(key, value);
    }

    return element;
  },

  retrieve: function(element, key, defaultValue) {
    if (!(element = $(element))) return;
    var hash = Element.getStorage(element), value = hash.get(key);

    if (Object.isUndefined(value)) {
      hash.set(key, defaultValue);
      value = defaultValue;
    }

    return value;
  },

  clone: function(element, deep) {
    if (!(element = $(element))) return;
    var clone = element.cloneNode(deep);
    clone._prototypeUID = void 0;
    if (deep) {
      var descendants = Element.select(clone, '*'),
          i = descendants.length;
      while (i--) {
        descendants[i]._prototypeUID = void 0;
      }
    }
    return Element.extend(clone);
  },

  purge: function(element) {
    if (!(element = $(element))) return;
    var purgeElement = Element._purgeElement;

    purgeElement(element);

    var descendants = element.getElementsByTagName('*'),
     i = descendants.length;

    while (i--) purgeElement(descendants[i]);

    return null;
  }
});

(function() {

  function toDecimal(pctString) {
    var match = pctString.match(/^(\d+)%?$/i);
    if (!match) return null;
    return (Number(match[1]) / 100);
  }

  function getPixelValue(value, property, context) {
    var element = null;
    if (Object.isElement(value)) {
      element = value;
      value = element.getStyle(property);
    }

    if (value === null) {
      return null;
    }

    if ((/^(?:-)?\d+(\.\d+)?(px)?$/i).test(value)) {
      return window.parseFloat(value);
    }

    var isPercentage = value.include('%'), isViewport = (context === document.viewport);

    if (/\d/.test(value) && element && element.runtimeStyle && !(isPercentage && isViewport)) {
      var style = element.style.left, rStyle = element.runtimeStyle.left;
      element.runtimeStyle.left = element.currentStyle.left;
      element.style.left = value || 0;
      value = element.style.pixelLeft;
      element.style.left = style;
      element.runtimeStyle.left = rStyle;

      return value;
    }

    if (element && isPercentage) {
      context = context || element.parentNode;
      var decimal = toDecimal(value);
      var whole = null;
      var position = element.getStyle('position');

      var isHorizontal = property.include('left') || property.include('right') ||
       property.include('width');

      var isVertical =  property.include('top') || property.include('bottom') ||
        property.include('height');

      if (context === document.viewport) {
        if (isHorizontal) {
          whole = document.viewport.getWidth();
        } else if (isVertical) {
          whole = document.viewport.getHeight();
        }
      } else {
        if (isHorizontal) {
          whole = $(context).measure('width');
        } else if (isVertical) {
          whole = $(context).measure('height');
        }
      }

      return (whole === null) ? 0 : whole * decimal;
    }

    return 0;
  }

  function toCSSPixels(number) {
    if (Object.isString(number) && number.endsWith('px')) {
      return number;
    }
    return number + 'px';
  }

  function isDisplayed(element) {
    var originalElement = element;
    while (element && element.parentNode) {
      var display = element.getStyle('display');
      if (display === 'none') {
        return false;
      }
      element = $(element.parentNode);
    }
    return true;
  }

  var hasLayout = Prototype.K;
  if ('currentStyle' in document.documentElement) {
    hasLayout = function(element) {
      if (!element.currentStyle.hasLayout) {
        element.style.zoom = 1;
      }
      return element;
    };
  }

  function cssNameFor(key) {
    if (key.include('border')) key = key + '-width';
    return key.camelize();
  }

  Element.Layout = Class.create(Hash, {
    initialize: function($super, element, preCompute) {
      $super();
      this.element = $(element);

      Element.Layout.PROPERTIES.each( function(property) {
        this._set(property, null);
      }, this);

      if (preCompute) {
        this._preComputing = true;
        this._begin();
        Element.Layout.PROPERTIES.each( this._compute, this );
        this._end();
        this._preComputing = false;
      }
    },

    _set: function(property, value) {
      return Hash.prototype.set.call(this, property, value);
    },

    set: function(property, value) {
      throw "Properties of Element.Layout are read-only.";
    },

    get: function($super, property) {
      var value = $super(property);
      return value === null ? this._compute(property) : value;
    },

    _begin: function() {
      if (this._prepared) return;

      var element = this.element;
      if (isDisplayed(element)) {
        this._prepared = true;
        return;
      }

      var originalStyles = {
        position:   element.style.position   || '',
        width:      element.style.width      || '',
        visibility: element.style.visibility || '',
        display:    element.style.display    || ''
      };

      element.store('prototype_original_styles', originalStyles);

      var position = element.getStyle('position'),
       width = element.getStyle('width');

      if (width === "0px" || width === null) {
        element.style.display = 'block';
        width = element.getStyle('width');
      }

      var context = (position === 'fixed') ? document.viewport :
       element.parentNode;

      element.setStyle({
        position:   'absolute',
        visibility: 'hidden',
        display:    'block'
      });

      var positionedWidth = element.getStyle('width');

      var newWidth;
      if (width && (positionedWidth === width)) {
        newWidth = getPixelValue(element, 'width', context);
      } else if (position === 'absolute' || position === 'fixed') {
        newWidth = getPixelValue(element, 'width', context);
      } else {
        var parent = element.parentNode, pLayout = $(parent).getLayout();

        newWidth = pLayout.get('width') -
         this.get('margin-left') -
         this.get('border-left') -
         this.get('padding-left') -
         this.get('padding-right') -
         this.get('border-right') -
         this.get('margin-right');
      }

      element.setStyle({ width: newWidth + 'px' });

      this._prepared = true;
    },

    _end: function() {
      var element = this.element;
      var originalStyles = element.retrieve('prototype_original_styles');
      element.store('prototype_original_styles', null);
      element.setStyle(originalStyles);
      this._prepared = false;
    },

    _compute: function(property) {
      var COMPUTATIONS = Element.Layout.COMPUTATIONS;
      if (!(property in COMPUTATIONS)) {
        throw "Property not found.";
      }

      return this._set(property, COMPUTATIONS[property].call(this, this.element));
    },

    toObject: function() {
      var args = $A(arguments);
      var keys = (args.length === 0) ? Element.Layout.PROPERTIES :
       args.join(' ').split(' ');
      var obj = {};
      keys.each( function(key) {
        if (!Element.Layout.PROPERTIES.include(key)) return;
        var value = this.get(key);
        if (value != null) obj[key] = value;
      }, this);
      return obj;
    },

    toHash: function() {
      var obj = this.toObject.apply(this, arguments);
      return new Hash(obj);
    },

    toCSS: function() {
      var args = $A(arguments);
      var keys = (args.length === 0) ? Element.Layout.PROPERTIES :
       args.join(' ').split(' ');
      var css = {};

      keys.each( function(key) {
        if (!Element.Layout.PROPERTIES.include(key)) return;
        if (Element.Layout.COMPOSITE_PROPERTIES.include(key)) return;

        var value = this.get(key);
        if (value != null) css[cssNameFor(key)] = value + 'px';
      }, this);
      return css;
    },

    inspect: function() {
      return "#<Element.Layout>";
    }
  });

  Object.extend(Element.Layout, {
    PROPERTIES: $w('height width top left right bottom border-left border-right border-top border-bottom padding-left padding-right padding-top padding-bottom margin-top margin-bottom margin-left margin-right padding-box-width padding-box-height border-box-width border-box-height margin-box-width margin-box-height'),

    COMPOSITE_PROPERTIES: $w('padding-box-width padding-box-height margin-box-width margin-box-height border-box-width border-box-height'),

    COMPUTATIONS: {
      'height': function(element) {
        if (!this._preComputing) this._begin();

        var bHeight = this.get('border-box-height');
        if (bHeight <= 0) {
          if (!this._preComputing) this._end();
          return 0;
        }

        var bTop = this.get('border-top'),
         bBottom = this.get('border-bottom');

        var pTop = this.get('padding-top'),
         pBottom = this.get('padding-bottom');

        if (!this._preComputing) this._end();

        return bHeight - bTop - bBottom - pTop - pBottom;
      },

      'width': function(element) {
        if (!this._preComputing) this._begin();

        var bWidth = this.get('border-box-width');
        if (bWidth <= 0) {
          if (!this._preComputing) this._end();
          return 0;
        }

        var bLeft = this.get('border-left'),
         bRight = this.get('border-right');

        var pLeft = this.get('padding-left'),
         pRight = this.get('padding-right');

        if (!this._preComputing) this._end();

        return bWidth - bLeft - bRight - pLeft - pRight;
      },

      'padding-box-height': function(element) {
        var height = this.get('height'),
         pTop = this.get('padding-top'),
         pBottom = this.get('padding-bottom');

        return height + pTop + pBottom;
      },

      'padding-box-width': function(element) {
        var width = this.get('width'),
         pLeft = this.get('padding-left'),
         pRight = this.get('padding-right');

        return width + pLeft + pRight;
      },

      'border-box-height': function(element) {
        if (!this._preComputing) this._begin();
        var height = element.offsetHeight;
        if (!this._preComputing) this._end();
        return height;
      },

      'border-box-width': function(element) {
        if (!this._preComputing) this._begin();
        var width = element.offsetWidth;
        if (!this._preComputing) this._end();
        return width;
      },

      'margin-box-height': function(element) {
        var bHeight = this.get('border-box-height'),
         mTop = this.get('margin-top'),
         mBottom = this.get('margin-bottom');

        if (bHeight <= 0) return 0;

        return bHeight + mTop + mBottom;
      },

      'margin-box-width': function(element) {
        var bWidth = this.get('border-box-width'),
         mLeft = this.get('margin-left'),
         mRight = this.get('margin-right');

        if (bWidth <= 0) return 0;

        return bWidth + mLeft + mRight;
      },

      'top': function(element) {
        var offset = element.positionedOffset();
        return offset.top;
      },

      'bottom': function(element) {
        var offset = element.positionedOffset(),
         parent = element.getOffsetParent(),
         pHeight = parent.measure('height');

        var mHeight = this.get('border-box-height');

        return pHeight - mHeight - offset.top;
      },

      'left': function(element) {
        var offset = element.positionedOffset();
        return offset.left;
      },

      'right': function(element) {
        var offset = element.positionedOffset(),
         parent = element.getOffsetParent(),
         pWidth = parent.measure('width');

        var mWidth = this.get('border-box-width');

        return pWidth - mWidth - offset.left;
      },

      'padding-top': function(element) {
        return getPixelValue(element, 'paddingTop');
      },

      'padding-bottom': function(element) {
        return getPixelValue(element, 'paddingBottom');
      },

      'padding-left': function(element) {
        return getPixelValue(element, 'paddingLeft');
      },

      'padding-right': function(element) {
        return getPixelValue(element, 'paddingRight');
      },

      'border-top': function(element) {
        return getPixelValue(element, 'borderTopWidth');
      },

      'border-bottom': function(element) {
        return getPixelValue(element, 'borderBottomWidth');
      },

      'border-left': function(element) {
        return getPixelValue(element, 'borderLeftWidth');
      },

      'border-right': function(element) {
        return getPixelValue(element, 'borderRightWidth');
      },

      'margin-top': function(element) {
        return getPixelValue(element, 'marginTop');
      },

      'margin-bottom': function(element) {
        return getPixelValue(element, 'marginBottom');
      },

      'margin-left': function(element) {
        return getPixelValue(element, 'marginLeft');
      },

      'margin-right': function(element) {
        return getPixelValue(element, 'marginRight');
      }
    }
  });

  if ('getBoundingClientRect' in document.documentElement) {
    Object.extend(Element.Layout.COMPUTATIONS, {
      'right': function(element) {
        var parent = hasLayout(element.getOffsetParent());
        var rect = element.getBoundingClientRect(),
         pRect = parent.getBoundingClientRect();

        return (pRect.right - rect.right).round();
      },

      'bottom': function(element) {
        var parent = hasLayout(element.getOffsetParent());
        var rect = element.getBoundingClientRect(),
         pRect = parent.getBoundingClientRect();

        return (pRect.bottom - rect.bottom).round();
      }
    });
  }

  Element.Offset = Class.create({
    initialize: function(left, top) {
      this.left = left.round();
      this.top  = top.round();

      this[0] = this.left;
      this[1] = this.top;
    },

    relativeTo: function(offset) {
      return new Element.Offset(
        this.left - offset.left,
        this.top  - offset.top
      );
    },

    inspect: function() {
      return "#<Element.Offset left: #{left} top: #{top}>".interpolate(this);
    },

    toString: function() {
      return "[#{left}, #{top}]".interpolate(this);
    },

    toArray: function() {
      return [this.left, this.top];
    }
  });

  function getLayout(element, preCompute) {
    return new Element.Layout(element, preCompute);
  }

  function measure(element, property) {
    return $(element).getLayout().get(property);
  }

  function getDimensions(element) {
    element = $(element);
    var display = Element.getStyle(element, 'display');

    if (display && display !== 'none') {
      return { width: element.offsetWidth, height: element.offsetHeight };
    }

    var style = element.style;
    var originalStyles = {
      visibility: style.visibility,
      position:   style.position,
      display:    style.display
    };

    var newStyles = {
      visibility: 'hidden',
      display:    'block'
    };

    if (originalStyles.position !== 'fixed')
      newStyles.position = 'absolute';

    Element.setStyle(element, newStyles);

    var dimensions = {
      width:  element.offsetWidth,
      height: element.offsetHeight
    };

    Element.setStyle(element, originalStyles);

    return dimensions;
  }

  function getOffsetParent(element) {
    element = $(element);

    if (isDocument(element) || isDetached(element) || isBody(element) || isHtml(element))
      return $(document.body);

    var isInline = (Element.getStyle(element, 'display') === 'inline');
    if (!isInline && element.offsetParent) return $(element.offsetParent);

    while ((element = element.parentNode) && element !== document.body) {
      if (Element.getStyle(element, 'position') !== 'static') {
        return isHtml(element) ? $(document.body) : $(element);
      }
    }

    return $(document.body);
  }


  function cumulativeOffset(element) {
    element = $(element);
    var valueT = 0, valueL = 0;
    if (element.parentNode) {
      do {
        valueT += element.offsetTop  || 0;
        valueL += element.offsetLeft || 0;
        element = element.offsetParent;
      } while (element);
    }
    return new Element.Offset(valueL, valueT);
  }

  function positionedOffset(element) {
    element = $(element);

    var layout = element.getLayout();

    var valueT = 0, valueL = 0;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      element = element.offsetParent;
      if (element) {
        if (isBody(element)) break;
        var p = Element.getStyle(element, 'position');
        if (p !== 'static') break;
      }
    } while (element);

    valueL -= layout.get('margin-top');
    valueT -= layout.get('margin-left');

    return new Element.Offset(valueL, valueT);
  }

  function cumulativeScrollOffset(element) {
    var valueT = 0, valueL = 0;
    do {
      valueT += element.scrollTop  || 0;
      valueL += element.scrollLeft || 0;
      element = element.parentNode;
    } while (element);
    return new Element.Offset(valueL, valueT);
  }

  function viewportOffset(forElement) {
    element = $(element);
    var valueT = 0, valueL = 0, docBody = document.body;

    var element = forElement;
    do {
      valueT += element.offsetTop  || 0;
      valueL += element.offsetLeft || 0;
      if (element.offsetParent == docBody &&
        Element.getStyle(element, 'position') == 'absolute') break;
    } while (element = element.offsetParent);

    element = forElement;
    do {
      if (element != docBody) {
        valueT -= element.scrollTop  || 0;
        valueL -= element.scrollLeft || 0;
      }
    } while (element = element.parentNode);
    return new Element.Offset(valueL, valueT);
  }

  function absolutize(element) {
    element = $(element);

    if (Element.getStyle(element, 'position') === 'absolute') {
      return element;
    }

    var offsetParent = getOffsetParent(element);
    var eOffset = element.viewportOffset(),
     pOffset = offsetParent.viewportOffset();

    var offset = eOffset.relativeTo(pOffset);
    var layout = element.getLayout();

    element.store('prototype_absolutize_original_styles', {
      left:   element.getStyle('left'),
      top:    element.getStyle('top'),
      width:  element.getStyle('width'),
      height: element.getStyle('height')
    });

    element.setStyle({
      position: 'absolute',
      top:    offset.top + 'px',
      left:   offset.left + 'px',
      width:  layout.get('width') + 'px',
      height: layout.get('height') + 'px'
    });

    return element;
  }

  function relativize(element) {
    element = $(element);
    if (Element.getStyle(element, 'position') === 'relative') {
      return element;
    }

    var originalStyles =
     element.retrieve('prototype_absolutize_original_styles');

    if (originalStyles) element.setStyle(originalStyles);
    return element;
  }

  if (Prototype.Browser.IE) {
    getOffsetParent = getOffsetParent.wrap(
      function(proceed, element) {
        element = $(element);

        if (isDocument(element) || isDetached(element) || isBody(element) || isHtml(element))
          return $(document.body);

        var position = element.getStyle('position');
        if (position !== 'static') return proceed(element);

        element.setStyle({ position: 'relative' });
        var value = proceed(element);
        element.setStyle({ position: position });
        return value;
      }
    );

    positionedOffset = positionedOffset.wrap(function(proceed, element) {
      element = $(element);
      if (!element.parentNode) return new Element.Offset(0, 0);
      var position = element.getStyle('position');
      if (position !== 'static') return proceed(element);

      var offsetParent = element.getOffsetParent();
      if (offsetParent && offsetParent.getStyle('position') === 'fixed')
        hasLayout(offsetParent);

      element.setStyle({ position: 'relative' });
      var value = proceed(element);
      element.setStyle({ position: position });
      return value;
    });
  } else if (Prototype.Browser.Webkit) {
    cumulativeOffset = function(element) {
      element = $(element);
      var valueT = 0, valueL = 0;
      do {
        valueT += element.offsetTop  || 0;
        valueL += element.offsetLeft || 0;
        if (element.offsetParent == document.body)
          if (Element.getStyle(element, 'position') == 'absolute') break;

        element = element.offsetParent;
      } while (element);

      return new Element.Offset(valueL, valueT);
    };
  }


  Element.addMethods({
    getLayout:              getLayout,
    measure:                measure,
    getDimensions:          getDimensions,
    getOffsetParent:        getOffsetParent,
    cumulativeOffset:       cumulativeOffset,
    positionedOffset:       positionedOffset,
    cumulativeScrollOffset: cumulativeScrollOffset,
    viewportOffset:         viewportOffset,
    absolutize:             absolutize,
    relativize:             relativize
  });

  function isBody(element) {
    return element.nodeName.toUpperCase() === 'BODY';
  }

  function isHtml(element) {
    return element.nodeName.toUpperCase() === 'HTML';
  }

  function isDocument(element) {
    return element.nodeType === Node.DOCUMENT_NODE;
  }

  function isDetached(element) {
    return element !== document.body &&
     !Element.descendantOf(element, document.body);
  }

  if ('getBoundingClientRect' in document.documentElement) {
    Element.addMethods({
      viewportOffset: function(element) {
        element = $(element);
        if (isDetached(element)) return new Element.Offset(0, 0);

        var rect = element.getBoundingClientRect(),
         docEl = document.documentElement;
        return new Element.Offset(rect.left - docEl.clientLeft,
         rect.top - docEl.clientTop);
      }
    });
  }
})();
window.$$ = function() {
  var expression = $A(arguments).join(', ');
  return Prototype.Selector.select(expression, document);
};

Prototype.Selector = (function() {

  function select() {
    throw new Error('Method "Prototype.Selector.select" must be defined.');
  }

  function match() {
    throw new Error('Method "Prototype.Selector.match" must be defined.');
  }

  function find(elements, expression, index) {
    index = index || 0;
    var match = Prototype.Selector.match, length = elements.length, matchIndex = 0, i;

    for (i = 0; i < length; i++) {
      if (match(elements[i], expression) && index == matchIndex++) {
        return Element.extend(elements[i]);
      }
    }
  }

  function extendElements(elements) {
    for (var i = 0, length = elements.length; i < length; i++) {
      Element.extend(elements[i]);
    }
    return elements;
  }


  var K = Prototype.K;

  return {
    select: select,
    match: match,
    find: find,
    extendElements: (Element.extend === K) ? K : extendElements,
    extendElement: Element.extend
  };
})();
Prototype._original_property = window.Sizzle;
/*!
 * Sizzle CSS Selector Engine - v1.0
 *  Copyright 2009, The Dojo Foundation
 *  Released under the MIT, BSD, and GPL Licenses.
 *  More information: http://sizzlejs.com/
 */
(function(){

var chunker = /((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?((?:.|\r|\n)*)/g,
    done = 0,
	toString = Object.prototype.toString,
	hasDuplicate = false,
	baseHasDuplicate = true;

[0, 0].sort(function(){
	baseHasDuplicate = false;
	return 0;
});

var Sizzle = function(selector, context, results, seed) {
	results = results || [];
	var origContext = context = context || document;

	if ( context.nodeType !== 1 && context.nodeType !== 9 ) {
		return [];
	}

	if ( !selector || typeof selector !== "string" ) {
		return results;
	}

	var parts = [], m, set, checkSet, check, mode, extra, prune = true, contextXML = isXML(context),
		soFar = selector;

	while ( (chunker.exec(""), m = chunker.exec(soFar)) !== null ) {
		soFar = m[3];

		parts.push( m[1] );

		if ( m[2] ) {
			extra = m[3];
			break;
		}
	}

	if ( parts.length > 1 && origPOS.exec( selector ) ) {
		if ( parts.length === 2 && Expr.relative[ parts[0] ] ) {
			set = posProcess( parts[0] + parts[1], context );
		} else {
			set = Expr.relative[ parts[0] ] ?
				[ context ] :
				Sizzle( parts.shift(), context );

			while ( parts.length ) {
				selector = parts.shift();

				if ( Expr.relative[ selector ] )
					selector += parts.shift();

				set = posProcess( selector, set );
			}
		}
	} else {
		if ( !seed && parts.length > 1 && context.nodeType === 9 && !contextXML &&
				Expr.match.ID.test(parts[0]) && !Expr.match.ID.test(parts[parts.length - 1]) ) {
			var ret = Sizzle.find( parts.shift(), context, contextXML );
			context = ret.expr ? Sizzle.filter( ret.expr, ret.set )[0] : ret.set[0];
		}

		if ( context ) {
			var ret = seed ?
				{ expr: parts.pop(), set: makeArray(seed) } :
				Sizzle.find( parts.pop(), parts.length === 1 && (parts[0] === "~" || parts[0] === "+") && context.parentNode ? context.parentNode : context, contextXML );
			set = ret.expr ? Sizzle.filter( ret.expr, ret.set ) : ret.set;

			if ( parts.length > 0 ) {
				checkSet = makeArray(set);
			} else {
				prune = false;
			}

			while ( parts.length ) {
				var cur = parts.pop(), pop = cur;

				if ( !Expr.relative[ cur ] ) {
					cur = "";
				} else {
					pop = parts.pop();
				}

				if ( pop == null ) {
					pop = context;
				}

				Expr.relative[ cur ]( checkSet, pop, contextXML );
			}
		} else {
			checkSet = parts = [];
		}
	}

	if ( !checkSet ) {
		checkSet = set;
	}

	if ( !checkSet ) {
		throw "Syntax error, unrecognized expression: " + (cur || selector);
	}

	if ( toString.call(checkSet) === "[object Array]" ) {
		if ( !prune ) {
			results.push.apply( results, checkSet );
		} else if ( context && context.nodeType === 1 ) {
			for ( var i = 0; checkSet[i] != null; i++ ) {
				if ( checkSet[i] && (checkSet[i] === true || checkSet[i].nodeType === 1 && contains(context, checkSet[i])) ) {
					results.push( set[i] );
				}
			}
		} else {
			for ( var i = 0; checkSet[i] != null; i++ ) {
				if ( checkSet[i] && checkSet[i].nodeType === 1 ) {
					results.push( set[i] );
				}
			}
		}
	} else {
		makeArray( checkSet, results );
	}

	if ( extra ) {
		Sizzle( extra, origContext, results, seed );
		Sizzle.uniqueSort( results );
	}

	return results;
};

Sizzle.uniqueSort = function(results){
	if ( sortOrder ) {
		hasDuplicate = baseHasDuplicate;
		results.sort(sortOrder);

		if ( hasDuplicate ) {
			for ( var i = 1; i < results.length; i++ ) {
				if ( results[i] === results[i-1] ) {
					results.splice(i--, 1);
				}
			}
		}
	}

	return results;
};

Sizzle.matches = function(expr, set){
	return Sizzle(expr, null, null, set);
};

Sizzle.find = function(expr, context, isXML){
	var set, match;

	if ( !expr ) {
		return [];
	}

	for ( var i = 0, l = Expr.order.length; i < l; i++ ) {
		var type = Expr.order[i], match;

		if ( (match = Expr.leftMatch[ type ].exec( expr )) ) {
			var left = match[1];
			match.splice(1,1);

			if ( left.substr( left.length - 1 ) !== "\\" ) {
				match[1] = (match[1] || "").replace(/\\/g, "");
				set = Expr.find[ type ]( match, context, isXML );
				if ( set != null ) {
					expr = expr.replace( Expr.match[ type ], "" );
					break;
				}
			}
		}
	}

	if ( !set ) {
		set = context.getElementsByTagName("*");
	}

	return {set: set, expr: expr};
};

Sizzle.filter = function(expr, set, inplace, not){
	var old = expr, result = [], curLoop = set, match, anyFound,
		isXMLFilter = set && set[0] && isXML(set[0]);

	while ( expr && set.length ) {
		for ( var type in Expr.filter ) {
			if ( (match = Expr.match[ type ].exec( expr )) != null ) {
				var filter = Expr.filter[ type ], found, item;
				anyFound = false;

				if ( curLoop == result ) {
					result = [];
				}

				if ( Expr.preFilter[ type ] ) {
					match = Expr.preFilter[ type ]( match, curLoop, inplace, result, not, isXMLFilter );

					if ( !match ) {
						anyFound = found = true;
					} else if ( match === true ) {
						continue;
					}
				}

				if ( match ) {
					for ( var i = 0; (item = curLoop[i]) != null; i++ ) {
						if ( item ) {
							found = filter( item, match, i, curLoop );
							var pass = not ^ !!found;

							if ( inplace && found != null ) {
								if ( pass ) {
									anyFound = true;
								} else {
									curLoop[i] = false;
								}
							} else if ( pass ) {
								result.push( item );
								anyFound = true;
							}
						}
					}
				}

				if ( found !== undefined ) {
					if ( !inplace ) {
						curLoop = result;
					}

					expr = expr.replace( Expr.match[ type ], "" );

					if ( !anyFound ) {
						return [];
					}

					break;
				}
			}
		}

		if ( expr == old ) {
			if ( anyFound == null ) {
				throw "Syntax error, unrecognized expression: " + expr;
			} else {
				break;
			}
		}

		old = expr;
	}

	return curLoop;
};

var Expr = Sizzle.selectors = {
	order: [ "ID", "NAME", "TAG" ],
	match: {
		ID: /#((?:[\w\u00c0-\uFFFF-]|\\.)+)/,
		CLASS: /\.((?:[\w\u00c0-\uFFFF-]|\\.)+)/,
		NAME: /\[name=['"]*((?:[\w\u00c0-\uFFFF-]|\\.)+)['"]*\]/,
		ATTR: /\[\s*((?:[\w\u00c0-\uFFFF-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,
		TAG: /^((?:[\w\u00c0-\uFFFF\*-]|\\.)+)/,
		CHILD: /:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,
		POS: /:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,
		PSEUDO: /:((?:[\w\u00c0-\uFFFF-]|\\.)+)(?:\((['"]*)((?:\([^\)]+\)|[^\2\(\)]*)+)\2\))?/
	},
	leftMatch: {},
	attrMap: {
		"class": "className",
		"for": "htmlFor"
	},
	attrHandle: {
		href: function(elem){
			return elem.getAttribute("href");
		}
	},
	relative: {
		"+": function(checkSet, part, isXML){
			var isPartStr = typeof part === "string",
				isTag = isPartStr && !/\W/.test(part),
				isPartStrNotTag = isPartStr && !isTag;

			if ( isTag && !isXML ) {
				part = part.toUpperCase();
			}

			for ( var i = 0, l = checkSet.length, elem; i < l; i++ ) {
				if ( (elem = checkSet[i]) ) {
					while ( (elem = elem.previousSibling) && elem.nodeType !== 1 ) {}

					checkSet[i] = isPartStrNotTag || elem && elem.nodeName === part ?
						elem || false :
						elem === part;
				}
			}

			if ( isPartStrNotTag ) {
				Sizzle.filter( part, checkSet, true );
			}
		},
		">": function(checkSet, part, isXML){
			var isPartStr = typeof part === "string";

			if ( isPartStr && !/\W/.test(part) ) {
				part = isXML ? part : part.toUpperCase();

				for ( var i = 0, l = checkSet.length; i < l; i++ ) {
					var elem = checkSet[i];
					if ( elem ) {
						var parent = elem.parentNode;
						checkSet[i] = parent.nodeName === part ? parent : false;
					}
				}
			} else {
				for ( var i = 0, l = checkSet.length; i < l; i++ ) {
					var elem = checkSet[i];
					if ( elem ) {
						checkSet[i] = isPartStr ?
							elem.parentNode :
							elem.parentNode === part;
					}
				}

				if ( isPartStr ) {
					Sizzle.filter( part, checkSet, true );
				}
			}
		},
		"": function(checkSet, part, isXML){
			var doneName = done++, checkFn = dirCheck;

			if ( !/\W/.test(part) ) {
				var nodeCheck = part = isXML ? part : part.toUpperCase();
				checkFn = dirNodeCheck;
			}

			checkFn("parentNode", part, doneName, checkSet, nodeCheck, isXML);
		},
		"~": function(checkSet, part, isXML){
			var doneName = done++, checkFn = dirCheck;

			if ( typeof part === "string" && !/\W/.test(part) ) {
				var nodeCheck = part = isXML ? part : part.toUpperCase();
				checkFn = dirNodeCheck;
			}

			checkFn("previousSibling", part, doneName, checkSet, nodeCheck, isXML);
		}
	},
	find: {
		ID: function(match, context, isXML){
			if ( typeof context.getElementById !== "undefined" && !isXML ) {
				var m = context.getElementById(match[1]);
				return m ? [m] : [];
			}
		},
		NAME: function(match, context, isXML){
			if ( typeof context.getElementsByName !== "undefined" ) {
				var ret = [], results = context.getElementsByName(match[1]);

				for ( var i = 0, l = results.length; i < l; i++ ) {
					if ( results[i].getAttribute("name") === match[1] ) {
						ret.push( results[i] );
					}
				}

				return ret.length === 0 ? null : ret;
			}
		},
		TAG: function(match, context){
			return context.getElementsByTagName(match[1]);
		}
	},
	preFilter: {
		CLASS: function(match, curLoop, inplace, result, not, isXML){
			match = " " + match[1].replace(/\\/g, "") + " ";

			if ( isXML ) {
				return match;
			}

			for ( var i = 0, elem; (elem = curLoop[i]) != null; i++ ) {
				if ( elem ) {
					if ( not ^ (elem.className && (" " + elem.className + " ").indexOf(match) >= 0) ) {
						if ( !inplace )
							result.push( elem );
					} else if ( inplace ) {
						curLoop[i] = false;
					}
				}
			}

			return false;
		},
		ID: function(match){
			return match[1].replace(/\\/g, "");
		},
		TAG: function(match, curLoop){
			for ( var i = 0; curLoop[i] === false; i++ ){}
			return curLoop[i] && isXML(curLoop[i]) ? match[1] : match[1].toUpperCase();
		},
		CHILD: function(match){
			if ( match[1] == "nth" ) {
				var test = /(-?)(\d*)n((?:\+|-)?\d*)/.exec(
					match[2] == "even" && "2n" || match[2] == "odd" && "2n+1" ||
					!/\D/.test( match[2] ) && "0n+" + match[2] || match[2]);

				match[2] = (test[1] + (test[2] || 1)) - 0;
				match[3] = test[3] - 0;
			}

			match[0] = done++;

			return match;
		},
		ATTR: function(match, curLoop, inplace, result, not, isXML){
			var name = match[1].replace(/\\/g, "");

			if ( !isXML && Expr.attrMap[name] ) {
				match[1] = Expr.attrMap[name];
			}

			if ( match[2] === "~=" ) {
				match[4] = " " + match[4] + " ";
			}

			return match;
		},
		PSEUDO: function(match, curLoop, inplace, result, not){
			if ( match[1] === "not" ) {
				if ( ( chunker.exec(match[3]) || "" ).length > 1 || /^\w/.test(match[3]) ) {
					match[3] = Sizzle(match[3], null, null, curLoop);
				} else {
					var ret = Sizzle.filter(match[3], curLoop, inplace, true ^ not);
					if ( !inplace ) {
						result.push.apply( result, ret );
					}
					return false;
				}
			} else if ( Expr.match.POS.test( match[0] ) || Expr.match.CHILD.test( match[0] ) ) {
				return true;
			}

			return match;
		},
		POS: function(match){
			match.unshift( true );
			return match;
		}
	},
	filters: {
		enabled: function(elem){
			return elem.disabled === false && elem.type !== "hidden";
		},
		disabled: function(elem){
			return elem.disabled === true;
		},
		checked: function(elem){
			return elem.checked === true;
		},
		selected: function(elem){
			elem.parentNode.selectedIndex;
			return elem.selected === true;
		},
		parent: function(elem){
			return !!elem.firstChild;
		},
		empty: function(elem){
			return !elem.firstChild;
		},
		has: function(elem, i, match){
			return !!Sizzle( match[3], elem ).length;
		},
		header: function(elem){
			return /h\d/i.test( elem.nodeName );
		},
		text: function(elem){
			return "text" === elem.type;
		},
		radio: function(elem){
			return "radio" === elem.type;
		},
		checkbox: function(elem){
			return "checkbox" === elem.type;
		},
		file: function(elem){
			return "file" === elem.type;
		},
		password: function(elem){
			return "password" === elem.type;
		},
		submit: function(elem){
			return "submit" === elem.type;
		},
		image: function(elem){
			return "image" === elem.type;
		},
		reset: function(elem){
			return "reset" === elem.type;
		},
		button: function(elem){
			return "button" === elem.type || elem.nodeName.toUpperCase() === "BUTTON";
		},
		input: function(elem){
			return /input|select|textarea|button/i.test(elem.nodeName);
		}
	},
	setFilters: {
		first: function(elem, i){
			return i === 0;
		},
		last: function(elem, i, match, array){
			return i === array.length - 1;
		},
		even: function(elem, i){
			return i % 2 === 0;
		},
		odd: function(elem, i){
			return i % 2 === 1;
		},
		lt: function(elem, i, match){
			return i < match[3] - 0;
		},
		gt: function(elem, i, match){
			return i > match[3] - 0;
		},
		nth: function(elem, i, match){
			return match[3] - 0 == i;
		},
		eq: function(elem, i, match){
			return match[3] - 0 == i;
		}
	},
	filter: {
		PSEUDO: function(elem, match, i, array){
			var name = match[1], filter = Expr.filters[ name ];

			if ( filter ) {
				return filter( elem, i, match, array );
			} else if ( name === "contains" ) {
				return (elem.textContent || elem.innerText || "").indexOf(match[3]) >= 0;
			} else if ( name === "not" ) {
				var not = match[3];

				for ( var i = 0, l = not.length; i < l; i++ ) {
					if ( not[i] === elem ) {
						return false;
					}
				}

				return true;
			}
		},
		CHILD: function(elem, match){
			var type = match[1], node = elem;
			switch (type) {
				case 'only':
				case 'first':
					while ( (node = node.previousSibling) )  {
						if ( node.nodeType === 1 ) return false;
					}
					if ( type == 'first') return true;
					node = elem;
				case 'last':
					while ( (node = node.nextSibling) )  {
						if ( node.nodeType === 1 ) return false;
					}
					return true;
				case 'nth':
					var first = match[2], last = match[3];

					if ( first == 1 && last == 0 ) {
						return true;
					}

					var doneName = match[0],
						parent = elem.parentNode;

					if ( parent && (parent.sizcache !== doneName || !elem.nodeIndex) ) {
						var count = 0;
						for ( node = parent.firstChild; node; node = node.nextSibling ) {
							if ( node.nodeType === 1 ) {
								node.nodeIndex = ++count;
							}
						}
						parent.sizcache = doneName;
					}

					var diff = elem.nodeIndex - last;
					if ( first == 0 ) {
						return diff == 0;
					} else {
						return ( diff % first == 0 && diff / first >= 0 );
					}
			}
		},
		ID: function(elem, match){
			return elem.nodeType === 1 && elem.getAttribute("id") === match;
		},
		TAG: function(elem, match){
			return (match === "*" && elem.nodeType === 1) || elem.nodeName === match;
		},
		CLASS: function(elem, match){
			return (" " + (elem.className || elem.getAttribute("class")) + " ")
				.indexOf( match ) > -1;
		},
		ATTR: function(elem, match){
			var name = match[1],
				result = Expr.attrHandle[ name ] ?
					Expr.attrHandle[ name ]( elem ) :
					elem[ name ] != null ?
						elem[ name ] :
						elem.getAttribute( name ),
				value = result + "",
				type = match[2],
				check = match[4];

			return result == null ?
				type === "!=" :
				type === "=" ?
				value === check :
				type === "*=" ?
				value.indexOf(check) >= 0 :
				type === "~=" ?
				(" " + value + " ").indexOf(check) >= 0 :
				!check ?
				value && result !== false :
				type === "!=" ?
				value != check :
				type === "^=" ?
				value.indexOf(check) === 0 :
				type === "$=" ?
				value.substr(value.length - check.length) === check :
				type === "|=" ?
				value === check || value.substr(0, check.length + 1) === check + "-" :
				false;
		},
		POS: function(elem, match, i, array){
			var name = match[2], filter = Expr.setFilters[ name ];

			if ( filter ) {
				return filter( elem, i, match, array );
			}
		}
	}
};

var origPOS = Expr.match.POS;

for ( var type in Expr.match ) {
	Expr.match[ type ] = new RegExp( Expr.match[ type ].source + /(?![^\[]*\])(?![^\(]*\))/.source );
	Expr.leftMatch[ type ] = new RegExp( /(^(?:.|\r|\n)*?)/.source + Expr.match[ type ].source );
}

var makeArray = function(array, results) {
	array = Array.prototype.slice.call( array, 0 );

	if ( results ) {
		results.push.apply( results, array );
		return results;
	}

	return array;
};

try {
	Array.prototype.slice.call( document.documentElement.childNodes, 0 );

} catch(e){
	makeArray = function(array, results) {
		var ret = results || [];

		if ( toString.call(array) === "[object Array]" ) {
			Array.prototype.push.apply( ret, array );
		} else {
			if ( typeof array.length === "number" ) {
				for ( var i = 0, l = array.length; i < l; i++ ) {
					ret.push( array[i] );
				}
			} else {
				for ( var i = 0; array[i]; i++ ) {
					ret.push( array[i] );
				}
			}
		}

		return ret;
	};
}

var sortOrder;

if ( document.documentElement.compareDocumentPosition ) {
	sortOrder = function( a, b ) {
		if ( !a.compareDocumentPosition || !b.compareDocumentPosition ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return 0;
		}

		var ret = a.compareDocumentPosition(b) & 4 ? -1 : a === b ? 0 : 1;
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
} else if ( "sourceIndex" in document.documentElement ) {
	sortOrder = function( a, b ) {
		if ( !a.sourceIndex || !b.sourceIndex ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return 0;
		}

		var ret = a.sourceIndex - b.sourceIndex;
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
} else if ( document.createRange ) {
	sortOrder = function( a, b ) {
		if ( !a.ownerDocument || !b.ownerDocument ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return 0;
		}

		var aRange = a.ownerDocument.createRange(), bRange = b.ownerDocument.createRange();
		aRange.setStart(a, 0);
		aRange.setEnd(a, 0);
		bRange.setStart(b, 0);
		bRange.setEnd(b, 0);
		var ret = aRange.compareBoundaryPoints(Range.START_TO_END, bRange);
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
}

(function(){
	var form = document.createElement("div"),
		id = "script" + (new Date).getTime();
	form.innerHTML = "<a name='" + id + "'/>";

	var root = document.documentElement;
	root.insertBefore( form, root.firstChild );

	if ( !!document.getElementById( id ) ) {
		Expr.find.ID = function(match, context, isXML){
			if ( typeof context.getElementById !== "undefined" && !isXML ) {
				var m = context.getElementById(match[1]);
				return m ? m.id === match[1] || typeof m.getAttributeNode !== "undefined" && m.getAttributeNode("id").nodeValue === match[1] ? [m] : undefined : [];
			}
		};

		Expr.filter.ID = function(elem, match){
			var node = typeof elem.getAttributeNode !== "undefined" && elem.getAttributeNode("id");
			return elem.nodeType === 1 && node && node.nodeValue === match;
		};
	}

	root.removeChild( form );
	root = form = null; // release memory in IE
})();

(function(){

	var div = document.createElement("div");
	div.appendChild( document.createComment("") );

	if ( div.getElementsByTagName("*").length > 0 ) {
		Expr.find.TAG = function(match, context){
			var results = context.getElementsByTagName(match[1]);

			if ( match[1] === "*" ) {
				var tmp = [];

				for ( var i = 0; results[i]; i++ ) {
					if ( results[i].nodeType === 1 ) {
						tmp.push( results[i] );
					}
				}

				results = tmp;
			}

			return results;
		};
	}

	div.innerHTML = "<a href='#'></a>";
	if ( div.firstChild && typeof div.firstChild.getAttribute !== "undefined" &&
			div.firstChild.getAttribute("href") !== "#" ) {
		Expr.attrHandle.href = function(elem){
			return elem.getAttribute("href", 2);
		};
	}

	div = null; // release memory in IE
})();

if ( document.querySelectorAll ) (function(){
	var oldSizzle = Sizzle, div = document.createElement("div");
	div.innerHTML = "<p class='TEST'></p>";

	if ( div.querySelectorAll && div.querySelectorAll(".TEST").length === 0 ) {
		return;
	}

	Sizzle = function(query, context, extra, seed){
		context = context || document;

		if ( !seed && context.nodeType === 9 && !isXML(context) ) {
			try {
				return makeArray( context.querySelectorAll(query), extra );
			} catch(e){}
		}

		return oldSizzle(query, context, extra, seed);
	};

	for ( var prop in oldSizzle ) {
		Sizzle[ prop ] = oldSizzle[ prop ];
	}

	div = null; // release memory in IE
})();

if ( document.getElementsByClassName && document.documentElement.getElementsByClassName ) (function(){
	var div = document.createElement("div");
	div.innerHTML = "<div class='test e'></div><div class='test'></div>";

	if ( div.getElementsByClassName("e").length === 0 )
		return;

	div.lastChild.className = "e";

	if ( div.getElementsByClassName("e").length === 1 )
		return;

	Expr.order.splice(1, 0, "CLASS");
	Expr.find.CLASS = function(match, context, isXML) {
		if ( typeof context.getElementsByClassName !== "undefined" && !isXML ) {
			return context.getElementsByClassName(match[1]);
		}
	};

	div = null; // release memory in IE
})();

function dirNodeCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
	var sibDir = dir == "previousSibling" && !isXML;
	for ( var i = 0, l = checkSet.length; i < l; i++ ) {
		var elem = checkSet[i];
		if ( elem ) {
			if ( sibDir && elem.nodeType === 1 ){
				elem.sizcache = doneName;
				elem.sizset = i;
			}
			elem = elem[dir];
			var match = false;

			while ( elem ) {
				if ( elem.sizcache === doneName ) {
					match = checkSet[elem.sizset];
					break;
				}

				if ( elem.nodeType === 1 && !isXML ){
					elem.sizcache = doneName;
					elem.sizset = i;
				}

				if ( elem.nodeName === cur ) {
					match = elem;
					break;
				}

				elem = elem[dir];
			}

			checkSet[i] = match;
		}
	}
}

function dirCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
	var sibDir = dir == "previousSibling" && !isXML;
	for ( var i = 0, l = checkSet.length; i < l; i++ ) {
		var elem = checkSet[i];
		if ( elem ) {
			if ( sibDir && elem.nodeType === 1 ) {
				elem.sizcache = doneName;
				elem.sizset = i;
			}
			elem = elem[dir];
			var match = false;

			while ( elem ) {
				if ( elem.sizcache === doneName ) {
					match = checkSet[elem.sizset];
					break;
				}

				if ( elem.nodeType === 1 ) {
					if ( !isXML ) {
						elem.sizcache = doneName;
						elem.sizset = i;
					}
					if ( typeof cur !== "string" ) {
						if ( elem === cur ) {
							match = true;
							break;
						}

					} else if ( Sizzle.filter( cur, [elem] ).length > 0 ) {
						match = elem;
						break;
					}
				}

				elem = elem[dir];
			}

			checkSet[i] = match;
		}
	}
}

var contains = document.compareDocumentPosition ?  function(a, b){
	return a.compareDocumentPosition(b) & 16;
} : function(a, b){
	return a !== b && (a.contains ? a.contains(b) : true);
};

var isXML = function(elem){
	return elem.nodeType === 9 && elem.documentElement.nodeName !== "HTML" ||
		!!elem.ownerDocument && elem.ownerDocument.documentElement.nodeName !== "HTML";
};

var posProcess = function(selector, context){
	var tmpSet = [], later = "", match,
		root = context.nodeType ? [context] : context;

	while ( (match = Expr.match.PSEUDO.exec( selector )) ) {
		later += match[0];
		selector = selector.replace( Expr.match.PSEUDO, "" );
	}

	selector = Expr.relative[selector] ? selector + "*" : selector;

	for ( var i = 0, l = root.length; i < l; i++ ) {
		Sizzle( selector, root[i], tmpSet );
	}

	return Sizzle.filter( later, tmpSet );
};


window.Sizzle = Sizzle;

})();

;(function(engine) {
  var extendElements = Prototype.Selector.extendElements;

  function select(selector, scope) {
    return extendElements(engine(selector, scope || document));
  }

  function match(element, selector) {
    return engine.matches(selector, [element]).length == 1;
  }

  Prototype.Selector.engine = engine;
  Prototype.Selector.select = select;
  Prototype.Selector.match = match;
})(Sizzle);

window.Sizzle = Prototype._original_property;
delete Prototype._original_property;

var Form = {
  reset: function(form) {
    form = $(form);
    form.reset();
    return form;
  },

  serializeElements: function(elements, options) {
    if (typeof options != 'object') options = { hash: !!options };
    else if (Object.isUndefined(options.hash)) options.hash = true;
    var key, value, submitted = false, submit = options.submit, accumulator, initial;

    if (options.hash) {
      initial = {};
      accumulator = function(result, key, value) {
        if (key in result) {
          if (!Object.isArray(result[key])) result[key] = [result[key]];
          result[key].push(value);
        } else result[key] = value;
        return result;
      };
    } else {
      initial = '';
      accumulator = function(result, key, value) {
        return result + (result ? '&' : '') + encodeURIComponent(key) + '=' + encodeURIComponent(value);
      }
    }

    return elements.inject(initial, function(result, element) {
      if (!element.disabled && element.name) {
        key = element.name; value = $(element).getValue();
        if (value != null && element.type != 'file' && (element.type != 'submit' || (!submitted &&
            submit !== false && (!submit || key == submit) && (submitted = true)))) {
          result = accumulator(result, key, value);
        }
      }
      return result;
    });
  }
};

Form.Methods = {
  serialize: function(form, options) {
    return Form.serializeElements(Form.getElements(form), options);
  },

  getElements: function(form) {
    var elements = $(form).getElementsByTagName('*'),
        element,
        arr = [ ],
        serializers = Form.Element.Serializers;
    for (var i = 0; element = elements[i]; i++) {
      arr.push(element);
    }
    return arr.inject([], function(elements, child) {
      if (serializers[child.tagName.toLowerCase()])
        elements.push(Element.extend(child));
      return elements;
    })
  },

  getInputs: function(form, typeName, name) {
    form = $(form);
    var inputs = form.getElementsByTagName('input');

    if (!typeName && !name) return $A(inputs).map(Element.extend);

    for (var i = 0, matchingInputs = [], length = inputs.length; i < length; i++) {
      var input = inputs[i];
      if ((typeName && input.type != typeName) || (name && input.name != name))
        continue;
      matchingInputs.push(Element.extend(input));
    }

    return matchingInputs;
  },

  disable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('disable');
    return form;
  },

  enable: function(form) {
    form = $(form);
    Form.getElements(form).invoke('enable');
    return form;
  },

  findFirstElement: function(form) {
    var elements = $(form).getElements().findAll(function(element) {
      return 'hidden' != element.type && !element.disabled;
    });
    var firstByIndex = elements.findAll(function(element) {
      return element.hasAttribute('tabIndex') && element.tabIndex >= 0;
    }).sortBy(function(element) { return element.tabIndex }).first();

    return firstByIndex ? firstByIndex : elements.find(function(element) {
      return /^(?:input|select|textarea)$/i.test(element.tagName);
    });
  },

  focusFirstElement: function(form) {
    form = $(form);
    var element = form.findFirstElement();
    if (element) element.activate();
    return form;
  },

  request: function(form, options) {
    form = $(form), options = Object.clone(options || { });

    var params = options.parameters, action = form.readAttribute('action') || '';
    if (action.blank()) action = window.location.href;
    options.parameters = form.serialize(true);

    if (params) {
      if (Object.isString(params)) params = params.toQueryParams();
      Object.extend(options.parameters, params);
    }

    if (form.hasAttribute('method') && !options.method)
      options.method = form.method;

    return new Ajax.Request(action, options);
  }
};

/*--------------------------------------------------------------------------*/


Form.Element = {
  focus: function(element) {
    $(element).focus();
    return element;
  },

  select: function(element) {
    $(element).select();
    return element;
  }
};

Form.Element.Methods = {

  serialize: function(element) {
    element = $(element);
    if (!element.disabled && element.name) {
      var value = element.getValue();
      if (value != undefined) {
        var pair = { };
        pair[element.name] = value;
        return Object.toQueryString(pair);
      }
    }
    return '';
  },

  getValue: function(element) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    return Form.Element.Serializers[method](element);
  },

  setValue: function(element, value) {
    element = $(element);
    var method = element.tagName.toLowerCase();
    Form.Element.Serializers[method](element, value);
    return element;
  },

  clear: function(element) {
    $(element).value = '';
    return element;
  },

  present: function(element) {
    return $(element).value != '';
  },

  activate: function(element) {
    element = $(element);
    try {
      element.focus();
      if (element.select && (element.tagName.toLowerCase() != 'input' ||
          !(/^(?:button|reset|submit)$/i.test(element.type))))
        element.select();
    } catch (e) { }
    return element;
  },

  disable: function(element) {
    element = $(element);
    element.disabled = true;
    return element;
  },

  enable: function(element) {
    element = $(element);
    element.disabled = false;
    return element;
  }
};

/*--------------------------------------------------------------------------*/

var Field = Form.Element;

var $F = Form.Element.Methods.getValue;

/*--------------------------------------------------------------------------*/

Form.Element.Serializers = (function() {
  function input(element, value) {
    switch (element.type.toLowerCase()) {
      case 'checkbox':
      case 'radio':
        return inputSelector(element, value);
      default:
        return valueSelector(element, value);
    }
  }

  function inputSelector(element, value) {
    if (Object.isUndefined(value))
      return element.checked ? element.value : null;
    else element.checked = !!value;
  }

  function valueSelector(element, value) {
    if (Object.isUndefined(value)) return element.value;
    else element.value = value;
  }

  function select(element, value) {
    if (Object.isUndefined(value))
      return (element.type === 'select-one' ? selectOne : selectMany)(element);

    var opt, currentValue, single = !Object.isArray(value);
    for (var i = 0, length = element.length; i < length; i++) {
      opt = element.options[i];
      currentValue = this.optionValue(opt);
      if (single) {
        if (currentValue == value) {
          opt.selected = true;
          return;
        }
      }
      else opt.selected = value.include(currentValue);
    }
  }

  function selectOne(element) {
    var index = element.selectedIndex;
    return index >= 0 ? optionValue(element.options[index]) : null;
  }

  function selectMany(element) {
    var values, length = element.length;
    if (!length) return null;

    for (var i = 0, values = []; i < length; i++) {
      var opt = element.options[i];
      if (opt.selected) values.push(optionValue(opt));
    }
    return values;
  }

  function optionValue(opt) {
    return Element.hasAttribute(opt, 'value') ? opt.value : opt.text;
  }

  return {
    input:         input,
    inputSelector: inputSelector,
    textarea:      valueSelector,
    select:        select,
    selectOne:     selectOne,
    selectMany:    selectMany,
    optionValue:   optionValue,
    button:        valueSelector
  };
})();

/*--------------------------------------------------------------------------*/


Abstract.TimedObserver = Class.create(PeriodicalExecuter, {
  initialize: function($super, element, frequency, callback) {
    $super(callback, frequency);
    this.element   = $(element);
    this.lastValue = this.getValue();
  },

  execute: function() {
    var value = this.getValue();
    if (Object.isString(this.lastValue) && Object.isString(value) ?
        this.lastValue != value : String(this.lastValue) != String(value)) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  }
});

Form.Element.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.Observer = Class.create(Abstract.TimedObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});

/*--------------------------------------------------------------------------*/

Abstract.EventObserver = Class.create({
  initialize: function(element, callback) {
    this.element  = $(element);
    this.callback = callback;

    this.lastValue = this.getValue();
    if (this.element.tagName.toLowerCase() == 'form')
      this.registerFormCallbacks();
    else
      this.registerCallback(this.element);
  },

  onElementEvent: function() {
    var value = this.getValue();
    if (this.lastValue != value) {
      this.callback(this.element, value);
      this.lastValue = value;
    }
  },

  registerFormCallbacks: function() {
    Form.getElements(this.element).each(this.registerCallback, this);
  },

  registerCallback: function(element) {
    if (element.type) {
      switch (element.type.toLowerCase()) {
        case 'checkbox':
        case 'radio':
          Event.observe(element, 'click', this.onElementEvent.bind(this));
          break;
        default:
          Event.observe(element, 'change', this.onElementEvent.bind(this));
          break;
      }
    }
  }
});

Form.Element.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.Element.getValue(this.element);
  }
});

Form.EventObserver = Class.create(Abstract.EventObserver, {
  getValue: function() {
    return Form.serialize(this.element);
  }
});
(function() {

  var Event = {
    KEY_BACKSPACE: 8,
    KEY_TAB:       9,
    KEY_RETURN:   13,
    KEY_ESC:      27,
    KEY_LEFT:     37,
    KEY_UP:       38,
    KEY_RIGHT:    39,
    KEY_DOWN:     40,
    KEY_DELETE:   46,
    KEY_HOME:     36,
    KEY_END:      35,
    KEY_PAGEUP:   33,
    KEY_PAGEDOWN: 34,
    KEY_INSERT:   45,

    cache: {}
  };

  var docEl = document.documentElement;
  var MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED = 'onmouseenter' in docEl
    && 'onmouseleave' in docEl;



  var isIELegacyEvent = function(event) { return false; };

  if (window.attachEvent) {
    if (window.addEventListener) {
      isIELegacyEvent = function(event) {
        return !(event instanceof window.Event);
      };
    } else {
      isIELegacyEvent = function(event) { return true; };
    }
  }

  var _isButton;

  function _isButtonForDOMEvents(event, code) {
    return event.which ? (event.which === code + 1) : (event.button === code);
  }

  var legacyButtonMap = { 0: 1, 1: 4, 2: 2 };
  function _isButtonForLegacyEvents(event, code) {
    return event.button === legacyButtonMap[code];
  }

  function _isButtonForWebKit(event, code) {
    switch (code) {
      case 0: return event.which == 1 && !event.metaKey;
      case 1: return event.which == 2 || (event.which == 1 && event.metaKey);
      case 2: return event.which == 3;
      default: return false;
    }
  }

  if (window.attachEvent) {
    if (!window.addEventListener) {
      _isButton = _isButtonForLegacyEvents;
    } else {
      _isButton = function(event, code) {
        return isIELegacyEvent(event) ? _isButtonForLegacyEvents(event, code) :
         _isButtonForDOMEvents(event, code);
      }
    }
  } else if (Prototype.Browser.WebKit) {
    _isButton = _isButtonForWebKit;
  } else {
    _isButton = _isButtonForDOMEvents;
  }

  function isLeftClick(event)   { return _isButton(event, 0) }

  function isMiddleClick(event) { return _isButton(event, 1) }

  function isRightClick(event)  { return _isButton(event, 2) }

  function element(event) {
    event = Event.extend(event);

    var node = event.target, type = event.type,
     currentTarget = event.currentTarget;

    if (currentTarget && currentTarget.tagName) {
      if (type === 'load' || type === 'error' ||
        (type === 'click' && currentTarget.tagName.toLowerCase() === 'input'
          && currentTarget.type === 'radio'))
            node = currentTarget;
    }

    if (node.nodeType == Node.TEXT_NODE)
      node = node.parentNode;

    return Element.extend(node);
  }

  function findElement(event, expression) {
    var element = Event.element(event);

    if (!expression) return element;
    while (element) {
      if (Object.isElement(element) && Prototype.Selector.match(element, expression)) {
        return Element.extend(element);
      }
      element = element.parentNode;
    }
  }

  function pointer(event) {
    return { x: pointerX(event), y: pointerY(event) };
  }

  function pointerX(event) {
    var docElement = document.documentElement,
     body = document.body || { scrollLeft: 0 };

    return event.pageX || (event.clientX +
      (docElement.scrollLeft || body.scrollLeft) -
      (docElement.clientLeft || 0));
  }

  function pointerY(event) {
    var docElement = document.documentElement,
     body = document.body || { scrollTop: 0 };

    return  event.pageY || (event.clientY +
       (docElement.scrollTop || body.scrollTop) -
       (docElement.clientTop || 0));
  }


  function stop(event) {
    Event.extend(event);
    event.preventDefault();
    event.stopPropagation();

    event.stopped = true;
  }


  Event.Methods = {
    isLeftClick:   isLeftClick,
    isMiddleClick: isMiddleClick,
    isRightClick:  isRightClick,

    element:     element,
    findElement: findElement,

    pointer:  pointer,
    pointerX: pointerX,
    pointerY: pointerY,

    stop: stop
  };

  var methods = Object.keys(Event.Methods).inject({ }, function(m, name) {
    m[name] = Event.Methods[name].methodize();
    return m;
  });

  if (window.attachEvent) {
    function _relatedTarget(event) {
      var element;
      switch (event.type) {
        case 'mouseover':
        case 'mouseenter':
          element = event.fromElement;
          break;
        case 'mouseout':
        case 'mouseleave':
          element = event.toElement;
          break;
        default:
          return null;
      }
      return Element.extend(element);
    }

    var additionalMethods = {
      stopPropagation: function() { this.cancelBubble = true },
      preventDefault:  function() { this.returnValue = false },
      inspect: function() { return '[object Event]' }
    };

    Event.extend = function(event, element) {
      if (!event) return false;

      if (!isIELegacyEvent(event)) return event;

      if (event._extendedByPrototype) return event;
      event._extendedByPrototype = Prototype.emptyFunction;

      var pointer = Event.pointer(event);

      Object.extend(event, {
        target: event.srcElement || element,
        relatedTarget: _relatedTarget(event),
        pageX:  pointer.x,
        pageY:  pointer.y
      });

      Object.extend(event, methods);
      Object.extend(event, additionalMethods);

      return event;
    };
  } else {
    Event.extend = Prototype.K;
  }

  if (window.addEventListener) {
    Event.prototype = window.Event.prototype || document.createEvent('HTMLEvents').__proto__;
    Object.extend(Event.prototype, methods);
  }

  function _createResponder(element, eventName, handler) {
    var registry = Element.retrieve(element, 'prototype_event_registry');

    if (Object.isUndefined(registry)) {
      CACHE.push(element);
      registry = Element.retrieve(element, 'prototype_event_registry', $H());
    }

    var respondersForEvent = registry.get(eventName);
    if (Object.isUndefined(respondersForEvent)) {
      respondersForEvent = [];
      registry.set(eventName, respondersForEvent);
    }

    if (respondersForEvent.pluck('handler').include(handler)) return false;

    var responder;
    if (eventName.include(":")) {
      responder = function(event) {
        if (Object.isUndefined(event.eventName))
          return false;

        if (event.eventName !== eventName)
          return false;

        Event.extend(event, element);
        handler.call(element, event);
      };
    } else {
      if (!MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED &&
       (eventName === "mouseenter" || eventName === "mouseleave")) {
        if (eventName === "mouseenter" || eventName === "mouseleave") {
          responder = function(event) {
            Event.extend(event, element);

            var parent = event.relatedTarget;
            while (parent && parent !== element) {
              try { parent = parent.parentNode; }
              catch(e) { parent = element; }
            }

            if (parent === element) return;

            handler.call(element, event);
          };
        }
      } else {
        responder = function(event) {
          Event.extend(event, element);
          handler.call(element, event);
        };
      }
    }

    responder.handler = handler;
    respondersForEvent.push(responder);
    return responder;
  }

  function _destroyCache() {
    for (var i = 0, length = CACHE.length; i < length; i++) {
      Event.stopObserving(CACHE[i]);
      CACHE[i] = null;
    }
  }

  var CACHE = [];

  if (Prototype.Browser.IE)
    window.attachEvent('onunload', _destroyCache);

  if (Prototype.Browser.WebKit)
    window.addEventListener('unload', Prototype.emptyFunction, false);


  var _getDOMEventName = Prototype.K,
      translations = { mouseenter: "mouseover", mouseleave: "mouseout" };

  if (!MOUSEENTER_MOUSELEAVE_EVENTS_SUPPORTED) {
    _getDOMEventName = function(eventName) {
      return (translations[eventName] || eventName);
    };
  }

  function observe(element, eventName, handler) {
    element = $(element);

    var responder = _createResponder(element, eventName, handler);

    if (!responder) return element;

    if (eventName.include(':')) {
      if (element.addEventListener)
        element.addEventListener("dataavailable", responder, false);
      else {
        element.attachEvent("ondataavailable", responder);
        element.attachEvent("onlosecapture", responder);
      }
    } else {
      var actualEventName = _getDOMEventName(eventName);

      if (element.addEventListener)
        element.addEventListener(actualEventName, responder, false);
      else
        element.attachEvent("on" + actualEventName, responder);
    }

    return element;
  }

  function stopObserving(element, eventName, handler) {
    element = $(element);

    var registry = Element.retrieve(element, 'prototype_event_registry');
    if (!registry) return element;

    if (!eventName) {
      registry.each( function(pair) {
        var eventName = pair.key;
        stopObserving(element, eventName);
      });
      return element;
    }

    var responders = registry.get(eventName);
    if (!responders) return element;

    if (!handler) {
      responders.each(function(r) {
        stopObserving(element, eventName, r.handler);
      });
      return element;
    }

    var i = responders.length, responder;
    while (i--) {
      if (responders[i].handler === handler) {
        responder = responders[i];
        break;
      }
    }
    if (!responder) return element;

    if (eventName.include(':')) {
      if (element.removeEventListener)
        element.removeEventListener("dataavailable", responder, false);
      else {
        element.detachEvent("ondataavailable", responder);
        element.detachEvent("onlosecapture", responder);
      }
    } else {
      var actualEventName = _getDOMEventName(eventName);
      if (element.removeEventListener)
        element.removeEventListener(actualEventName, responder, false);
      else
        element.detachEvent('on' + actualEventName, responder);
    }

    registry.set(eventName, responders.without(responder));

    return element;
  }

  function fire(element, eventName, memo, bubble) {
    element = $(element);

    if (Object.isUndefined(bubble))
      bubble = true;

    if (element == document && document.createEvent && !element.dispatchEvent)
      element = document.documentElement;

    var event;
    if (document.createEvent) {
      event = document.createEvent('HTMLEvents');
      event.initEvent('dataavailable', bubble, true);
    } else {
      event = document.createEventObject();
      event.eventType = bubble ? 'ondataavailable' : 'onlosecapture';
    }

    event.eventName = eventName;
    event.memo = memo || { };

    if (document.createEvent)
      element.dispatchEvent(event);
    else
      element.fireEvent(event.eventType, event);

    return Event.extend(event);
  }

  Event.Handler = Class.create({
    initialize: function(element, eventName, selector, callback) {
      this.element   = $(element);
      this.eventName = eventName;
      this.selector  = selector;
      this.callback  = callback;
      this.handler   = this.handleEvent.bind(this);
    },

    start: function() {
      Event.observe(this.element, this.eventName, this.handler);
      return this;
    },

    stop: function() {
      Event.stopObserving(this.element, this.eventName, this.handler);
      return this;
    },

    handleEvent: function(event) {
      var element = Event.findElement(event, this.selector);
      if (element) this.callback.call(this.element, event, element);
    }
  });

  function on(element, eventName, selector, callback) {
    element = $(element);
    if (Object.isFunction(selector) && Object.isUndefined(callback)) {
      callback = selector, selector = null;
    }

    return new Event.Handler(element, eventName, selector, callback).start();
  }

  Object.extend(Event, Event.Methods);

  Object.extend(Event, {
    fire:          fire,
    observe:       observe,
    stopObserving: stopObserving,
    on:            on
  });

  Element.addMethods({
    fire:          fire,

    observe:       observe,

    stopObserving: stopObserving,

    on:            on
  });

  Object.extend(document, {
    fire:          fire.methodize(),

    observe:       observe.methodize(),

    stopObserving: stopObserving.methodize(),

    on:            on.methodize(),

    loaded:        false
  });

  if (window.Event) Object.extend(window.Event, Event);
  else window.Event = Event;
})();

(function() {
  /* Support for the DOMContentLoaded event is based on work by Dan Webb,
     Matthias Miller, Dean Edwards, John Resig, and Diego Perini. */

  var timer;

  function fireContentLoadedEvent() {
    if (document.loaded) return;
    if (timer) window.clearTimeout(timer);
    document.loaded = true;
    document.fire('dom:loaded');
  }

  function checkReadyState() {
    if (document.readyState === 'complete') {
      document.stopObserving('readystatechange', checkReadyState);
      fireContentLoadedEvent();
    }
  }

  function pollDoScroll() {
    try { document.documentElement.doScroll('left'); }
    catch(e) {
      timer = pollDoScroll.defer();
      return;
    }
    fireContentLoadedEvent();
  }

  if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', fireContentLoadedEvent, false);
  } else {
    document.observe('readystatechange', checkReadyState);
    if (window == top)
      timer = pollDoScroll.defer();
  }

  Event.observe(window, 'load', fireContentLoadedEvent);
})();

Element.addMethods();

/*------------------------------- DEPRECATED -------------------------------*/

Hash.toQueryString = Object.toQueryString;

var Toggle = { display: Element.toggle };

Element.Methods.childOf = Element.Methods.descendantOf;

var Insertion = {
  Before: function(element, content) {
    return Element.insert(element, {before:content});
  },

  Top: function(element, content) {
    return Element.insert(element, {top:content});
  },

  Bottom: function(element, content) {
    return Element.insert(element, {bottom:content});
  },

  After: function(element, content) {
    return Element.insert(element, {after:content});
  }
};

var $continue = new Error('"throw $continue" is deprecated, use "return" instead');

var Position = {
  includeScrollOffsets: false,

  prepare: function() {
    this.deltaX =  window.pageXOffset
                || document.documentElement.scrollLeft
                || document.body.scrollLeft
                || 0;
    this.deltaY =  window.pageYOffset
                || document.documentElement.scrollTop
                || document.body.scrollTop
                || 0;
  },

  within: function(element, x, y) {
    if (this.includeScrollOffsets)
      return this.withinIncludingScrolloffsets(element, x, y);
    this.xcomp = x;
    this.ycomp = y;
    this.offset = Element.cumulativeOffset(element);

    return (y >= this.offset[1] &&
            y <  this.offset[1] + element.offsetHeight &&
            x >= this.offset[0] &&
            x <  this.offset[0] + element.offsetWidth);
  },

  withinIncludingScrolloffsets: function(element, x, y) {
    var offsetcache = Element.cumulativeScrollOffset(element);

    this.xcomp = x + offsetcache[0] - this.deltaX;
    this.ycomp = y + offsetcache[1] - this.deltaY;
    this.offset = Element.cumulativeOffset(element);

    return (this.ycomp >= this.offset[1] &&
            this.ycomp <  this.offset[1] + element.offsetHeight &&
            this.xcomp >= this.offset[0] &&
            this.xcomp <  this.offset[0] + element.offsetWidth);
  },

  overlap: function(mode, element) {
    if (!mode) return 0;
    if (mode == 'vertical')
      return ((this.offset[1] + element.offsetHeight) - this.ycomp) /
        element.offsetHeight;
    if (mode == 'horizontal')
      return ((this.offset[0] + element.offsetWidth) - this.xcomp) /
        element.offsetWidth;
  },


  cumulativeOffset: Element.Methods.cumulativeOffset,

  positionedOffset: Element.Methods.positionedOffset,

  absolutize: function(element) {
    Position.prepare();
    return Element.absolutize(element);
  },

  relativize: function(element) {
    Position.prepare();
    return Element.relativize(element);
  },

  realOffset: Element.Methods.cumulativeScrollOffset,

  offsetParent: Element.Methods.getOffsetParent,

  page: Element.Methods.viewportOffset,

  clone: function(source, target, options) {
    options = options || { };
    return Element.clonePosition(target, source, options);
  }
};

/*--------------------------------------------------------------------------*/

if (!document.getElementsByClassName) document.getElementsByClassName = function(instanceMethods){
  function iter(name) {
    return name.blank() ? null : "[contains(concat(' ', @class, ' '), ' " + name + " ')]";
  }

  instanceMethods.getElementsByClassName = Prototype.BrowserFeatures.XPath ?
  function(element, className) {
    className = className.toString().strip();
    var cond = /\s/.test(className) ? $w(className).map(iter).join('') : iter(className);
    return cond ? document._getElementsByXPath('.//*' + cond, element) : [];
  } : function(element, className) {
    className = className.toString().strip();
    var elements = [], classNames = (/\s/.test(className) ? $w(className) : null);
    if (!classNames && !className) return elements;

    var nodes = $(element).getElementsByTagName('*');
    className = ' ' + className + ' ';

    for (var i = 0, child, cn; child = nodes[i]; i++) {
      if (child.className && (cn = ' ' + child.className + ' ') && (cn.include(className) ||
          (classNames && classNames.all(function(name) {
            return !name.toString().blank() && cn.include(' ' + name + ' ');
          }))))
        elements.push(Element.extend(child));
    }
    return elements;
  };

  return function(className, parentElement) {
    return $(parentElement || document.body).getElementsByClassName(className);
  };
}(Element.Methods);

/*--------------------------------------------------------------------------*/

Element.ClassNames = Class.create();
Element.ClassNames.prototype = {
  initialize: function(element) {
    this.element = $(element);
  },

  _each: function(iterator) {
    this.element.className.split(/\s+/).select(function(name) {
      return name.length > 0;
    })._each(iterator);
  },

  set: function(className) {
    this.element.className = className;
  },

  add: function(classNameToAdd) {
    if (this.include(classNameToAdd)) return;
    this.set($A(this).concat(classNameToAdd).join(' '));
  },

  remove: function(classNameToRemove) {
    if (!this.include(classNameToRemove)) return;
    this.set($A(this).without(classNameToRemove).join(' '));
  },

  toString: function() {
    return $A(this).join(' ');
  }
};

Object.extend(Element.ClassNames.prototype, Enumerable);

/*--------------------------------------------------------------------------*/

(function() {
  window.Selector = Class.create({
    initialize: function(expression) {
      this.expression = expression.strip();
    },

    findElements: function(rootElement) {
      return Prototype.Selector.select(this.expression, rootElement);
    },

    match: function(element) {
      return Prototype.Selector.match(element, this.expression);
    },

    toString: function() {
      return this.expression;
    },

    inspect: function() {
      return "#<Selector: " + this.expression + ">";
    }
  });

  Object.extend(Selector, {
    matchElements: function(elements, expression) {
      var match = Prototype.Selector.match,
          results = [];

      for (var i = 0, length = elements.length; i < length; i++) {
        var element = elements[i];
        if (match(element, expression)) {
          results.push(Element.extend(element));
        }
      }
      return results;
    },

    findElement: function(elements, expression, index) {
      index = index || 0;
      var matchIndex = 0, element;
      for (var i = 0, length = elements.length; i < length; i++) {
        element = elements[i];
        if (Prototype.Selector.match(element, expression) && index === matchIndex++) {
          return Element.extend(element);
        }
      }
    },

    findChildElements: function(element, expressions) {
      var selector = expressions.toArray().join(', ');
      return Prototype.Selector.select(selector, element || document);
    }
  });
})();
// script.aculo.us effects.js v1.8.3, Thu Oct 08 11:23:33 +0200 2009

// Copyright (c) 2005-2009 Thomas Fuchs (http://script.aculo.us, http://mir.aculo.us)
// Contributors:
//  Justin Palmer (http://encytemedia.com/)
//  Mark Pilgrim (http://diveintomark.org/)
//  Martin Bialasinki
//
// script.aculo.us is freely distributable under the terms of an MIT-style license.
// For details, see the script.aculo.us web site: http://script.aculo.us/

// converts rgb() and #xxx to #xxxxxx format,
// returns self (or first argument) if not convertable
String.prototype.parseColor = function() {
  var color = '#';
  if (this.slice(0,4) == 'rgb(') {
    var cols = this.slice(4,this.length-1).split(',');
    var i=0; do { color += parseInt(cols[i]).toColorPart() } while (++i<3);
  } else {
    if (this.slice(0,1) == '#') {
      if (this.length==4) for(var i=1;i<4;i++) color += (this.charAt(i) + this.charAt(i)).toLowerCase();
      if (this.length==7) color = this.toLowerCase();
    }
  }
  return (color.length==7 ? color : (arguments[0] || this));
};

/*--------------------------------------------------------------------------*/

Element.collectTextNodes = function(element) {
  return $A($(element).childNodes).collect( function(node) {
    return (node.nodeType==3 ? node.nodeValue :
      (node.hasChildNodes() ? Element.collectTextNodes(node) : ''));
  }).flatten().join('');
};

Element.collectTextNodesIgnoreClass = function(element, className) {
  return $A($(element).childNodes).collect( function(node) {
    return (node.nodeType==3 ? node.nodeValue :
      ((node.hasChildNodes() && !Element.hasClassName(node,className)) ?
        Element.collectTextNodesIgnoreClass(node, className) : ''));
  }).flatten().join('');
};

Element.setContentZoom = function(element, percent) {
  element = $(element);
  element.setStyle({fontSize: (percent/100) + 'em'});
  if (Prototype.Browser.WebKit) window.scrollBy(0,0);
  return element;
};

Element.getInlineOpacity = function(element){
  return $(element).style.opacity || '';
};

Element.forceRerendering = function(element) {
  try {
    element = $(element);
    var n = document.createTextNode(' ');
    element.appendChild(n);
    element.removeChild(n);
  } catch(e) { }
};

/*--------------------------------------------------------------------------*/

var Effect = {
  _elementDoesNotExistError: {
    name: 'ElementDoesNotExistError',
    message: 'The specified DOM element does not exist, but is required for this effect to operate'
  },
  Transitions: {
    linear: Prototype.K,
    sinoidal: function(pos) {
      return (-Math.cos(pos*Math.PI)/2) + .5;
    },
    reverse: function(pos) {
      return 1-pos;
    },
    flicker: function(pos) {
      var pos = ((-Math.cos(pos*Math.PI)/4) + .75) + Math.random()/4;
      return pos > 1 ? 1 : pos;
    },
    wobble: function(pos) {
      return (-Math.cos(pos*Math.PI*(9*pos))/2) + .5;
    },
    pulse: function(pos, pulses) {
      return (-Math.cos((pos*((pulses||5)-.5)*2)*Math.PI)/2) + .5;
    },
    spring: function(pos) {
      return 1 - (Math.cos(pos * 4.5 * Math.PI) * Math.exp(-pos * 6));
    },
    none: function(pos) {
      return 0;
    },
    full: function(pos) {
      return 1;
    }
  },
  DefaultOptions: {
    duration:   1.0,   // seconds
    fps:        100,   // 100= assume 66fps max.
    sync:       false, // true for combining
    from:       0.0,
    to:         1.0,
    delay:      0.0,
    queue:      'parallel'
  },
  tagifyText: function(element) {
    var tagifyStyle = 'position:relative';
    if (Prototype.Browser.IE) tagifyStyle += ';zoom:1';

    element = $(element);
    $A(element.childNodes).each( function(child) {
      if (child.nodeType==3) {
        child.nodeValue.toArray().each( function(character) {
          element.insertBefore(
            new Element('span', {style: tagifyStyle}).update(
              character == ' ' ? String.fromCharCode(160) : character),
              child);
        });
        Element.remove(child);
      }
    });
  },
  multiple: function(element, effect) {
    var elements;
    if (((typeof element == 'object') ||
        Object.isFunction(element)) &&
       (element.length))
      elements = element;
    else
      elements = $(element).childNodes;

    var options = Object.extend({
      speed: 0.1,
      delay: 0.0
    }, arguments[2] || { });
    var masterDelay = options.delay;

    $A(elements).each( function(element, index) {
      new effect(element, Object.extend(options, { delay: index * options.speed + masterDelay }));
    });
  },
  PAIRS: {
    'slide':  ['SlideDown','SlideUp'],
    'blind':  ['BlindDown','BlindUp'],
    'appear': ['Appear','Fade']
  },
  toggle: function(element, effect, options) {
    element = $(element);
    effect  = (effect || 'appear').toLowerCase();
    
    return Effect[ Effect.PAIRS[ effect ][ element.visible() ? 1 : 0 ] ](element, Object.extend({
      queue: { position:'end', scope:(element.id || 'global'), limit: 1 }
    }, options || {}));
  }
};

Effect.DefaultOptions.transition = Effect.Transitions.sinoidal;

/* ------------- core effects ------------- */

Effect.ScopedQueue = Class.create(Enumerable, {
  initialize: function() {
    this.effects  = [];
    this.interval = null;
  },
  _each: function(iterator) {
    this.effects._each(iterator);
  },
  add: function(effect) {
    var timestamp = new Date().getTime();

    var position = Object.isString(effect.options.queue) ?
      effect.options.queue : effect.options.queue.position;

    switch(position) {
      case 'front':
        // move unstarted effects after this effect
        this.effects.findAll(function(e){ return e.state=='idle' }).each( function(e) {
            e.startOn  += effect.finishOn;
            e.finishOn += effect.finishOn;
          });
        break;
      case 'with-last':
        timestamp = this.effects.pluck('startOn').max() || timestamp;
        break;
      case 'end':
        // start effect after last queued effect has finished
        timestamp = this.effects.pluck('finishOn').max() || timestamp;
        break;
    }

    effect.startOn  += timestamp;
    effect.finishOn += timestamp;

    if (!effect.options.queue.limit || (this.effects.length < effect.options.queue.limit))
      this.effects.push(effect);

    if (!this.interval)
      this.interval = setInterval(this.loop.bind(this), 15);
  },
  remove: function(effect) {
    this.effects = this.effects.reject(function(e) { return e==effect });
    if (this.effects.length == 0) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },
  loop: function() {
    var timePos = new Date().getTime();
    for(var i=0, len=this.effects.length;i<len;i++)
      this.effects[i] && this.effects[i].loop(timePos);
  }
});

Effect.Queues = {
  instances: $H(),
  get: function(queueName) {
    if (!Object.isString(queueName)) return queueName;

    return this.instances.get(queueName) ||
      this.instances.set(queueName, new Effect.ScopedQueue());
  }
};
Effect.Queue = Effect.Queues.get('global');

Effect.Base = Class.create({
  position: null,
  start: function(options) {
    if (options && options.transition === false) options.transition = Effect.Transitions.linear;
    this.options      = Object.extend(Object.extend({ },Effect.DefaultOptions), options || { });
    this.currentFrame = 0;
    this.state        = 'idle';
    this.startOn      = this.options.delay*1000;
    this.finishOn     = this.startOn+(this.options.duration*1000);
    this.fromToDelta  = this.options.to-this.options.from;
    this.totalTime    = this.finishOn-this.startOn;
    this.totalFrames  = this.options.fps*this.options.duration;

    this.render = (function() {
      function dispatch(effect, eventName) {
        if (effect.options[eventName + 'Internal'])
          effect.options[eventName + 'Internal'](effect);
        if (effect.options[eventName])
          effect.options[eventName](effect);
      }

      return function(pos) {
        if (this.state === "idle") {
          this.state = "running";
          dispatch(this, 'beforeSetup');
          if (this.setup) this.setup();
          dispatch(this, 'afterSetup');
        }
        if (this.state === "running") {
          pos = (this.options.transition(pos) * this.fromToDelta) + this.options.from;
          this.position = pos;
          dispatch(this, 'beforeUpdate');
          if (this.update) this.update(pos);
          dispatch(this, 'afterUpdate');
        }
      };
    })();

    this.event('beforeStart');
    if (!this.options.sync)
      Effect.Queues.get(Object.isString(this.options.queue) ?
        'global' : this.options.queue.scope).add(this);
  },
  loop: function(timePos) {
    if (timePos >= this.startOn) {
      if (timePos >= this.finishOn) {
        this.render(1.0);
        this.cancel();
        this.event('beforeFinish');
        if (this.finish) this.finish();
        this.event('afterFinish');
        return;
      }
      var pos   = (timePos - this.startOn) / this.totalTime,
          frame = (pos * this.totalFrames).round();
      if (frame > this.currentFrame) {
        this.render(pos);
        this.currentFrame = frame;
      }
    }
  },
  cancel: function() {
    if (!this.options.sync)
      Effect.Queues.get(Object.isString(this.options.queue) ?
        'global' : this.options.queue.scope).remove(this);
    this.state = 'finished';
  },
  event: function(eventName) {
    if (this.options[eventName + 'Internal']) this.options[eventName + 'Internal'](this);
    if (this.options[eventName]) this.options[eventName](this);
  },
  inspect: function() {
    var data = $H();
    for(property in this)
      if (!Object.isFunction(this[property])) data.set(property, this[property]);
    return '#<Effect:' + data.inspect() + ',options:' + $H(this.options).inspect() + '>';
  }
});

Effect.Parallel = Class.create(Effect.Base, {
  initialize: function(effects) {
    this.effects = effects || [];
    this.start(arguments[1]);
  },
  update: function(position) {
    this.effects.invoke('render', position);
  },
  finish: function(position) {
    this.effects.each( function(effect) {
      effect.render(1.0);
      effect.cancel();
      effect.event('beforeFinish');
      if (effect.finish) effect.finish(position);
      effect.event('afterFinish');
    });
  }
});

Effect.Tween = Class.create(Effect.Base, {
  initialize: function(object, from, to) {
    object = Object.isString(object) ? $(object) : object;
    var args = $A(arguments), method = args.last(),
      options = args.length == 5 ? args[3] : null;
    this.method = Object.isFunction(method) ? method.bind(object) :
      Object.isFunction(object[method]) ? object[method].bind(object) :
      function(value) { object[method] = value };
    this.start(Object.extend({ from: from, to: to }, options || { }));
  },
  update: function(position) {
    this.method(position);
  }
});

Effect.Event = Class.create(Effect.Base, {
  initialize: function() {
    this.start(Object.extend({ duration: 0 }, arguments[0] || { }));
  },
  update: Prototype.emptyFunction
});

Effect.Opacity = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    // make this work on IE on elements without 'layout'
    if (Prototype.Browser.IE && (!this.element.currentStyle.hasLayout))
      this.element.setStyle({zoom: 1});
    var options = Object.extend({
      from: this.element.getOpacity() || 0.0,
      to:   1.0
    }, arguments[1] || { });
    this.start(options);
  },
  update: function(position) {
    this.element.setOpacity(position);
  }
});

Effect.Move = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      x:    0,
      y:    0,
      mode: 'relative'
    }, arguments[1] || { });
    this.start(options);
  },
  setup: function() {
    this.element.makePositioned();
    this.originalLeft = parseFloat(this.element.getStyle('left') || '0');
    this.originalTop  = parseFloat(this.element.getStyle('top')  || '0');
    if (this.options.mode == 'absolute') {
      this.options.x = this.options.x - this.originalLeft;
      this.options.y = this.options.y - this.originalTop;
    }
  },
  update: function(position) {
    this.element.setStyle({
      left: (this.options.x  * position + this.originalLeft).round() + 'px',
      top:  (this.options.y  * position + this.originalTop).round()  + 'px'
    });
  }
});

// for backwards compatibility
Effect.MoveBy = function(element, toTop, toLeft) {
  return new Effect.Move(element,
    Object.extend({ x: toLeft, y: toTop }, arguments[3] || { }));
};

Effect.Scale = Class.create(Effect.Base, {
  initialize: function(element, percent) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      scaleX: true,
      scaleY: true,
      scaleContent: true,
      scaleFromCenter: false,
      scaleMode: 'box',        // 'box' or 'contents' or { } with provided values
      scaleFrom: 100.0,
      scaleTo:   percent
    }, arguments[2] || { });
    this.start(options);
  },
  setup: function() {
    this.restoreAfterFinish = this.options.restoreAfterFinish || false;
    this.elementPositioning = this.element.getStyle('position');

    this.originalStyle = { };
    ['top','left','width','height','fontSize'].each( function(k) {
      this.originalStyle[k] = this.element.style[k];
    }.bind(this));

    this.originalTop  = this.element.offsetTop;
    this.originalLeft = this.element.offsetLeft;

    var fontSize = this.element.getStyle('font-size') || '100%';
    ['em','px','%','pt'].each( function(fontSizeType) {
      if (fontSize.indexOf(fontSizeType)>0) {
        this.fontSize     = parseFloat(fontSize);
        this.fontSizeType = fontSizeType;
      }
    }.bind(this));

    this.factor = (this.options.scaleTo - this.options.scaleFrom)/100;

    this.dims = null;
    if (this.options.scaleMode=='box')
      this.dims = [this.element.offsetHeight, this.element.offsetWidth];
    if (/^content/.test(this.options.scaleMode))
      this.dims = [this.element.scrollHeight, this.element.scrollWidth];
    if (!this.dims)
      this.dims = [this.options.scaleMode.originalHeight,
                   this.options.scaleMode.originalWidth];
  },
  update: function(position) {
    var currentScale = (this.options.scaleFrom/100.0) + (this.factor * position);
    if (this.options.scaleContent && this.fontSize)
      this.element.setStyle({fontSize: this.fontSize * currentScale + this.fontSizeType });
    this.setDimensions(this.dims[0] * currentScale, this.dims[1] * currentScale);
  },
  finish: function(position) {
    if (this.restoreAfterFinish) this.element.setStyle(this.originalStyle);
  },
  setDimensions: function(height, width) {
    var d = { };
    if (this.options.scaleX) d.width = width.round() + 'px';
    if (this.options.scaleY) d.height = height.round() + 'px';
    if (this.options.scaleFromCenter) {
      var topd  = (height - this.dims[0])/2;
      var leftd = (width  - this.dims[1])/2;
      if (this.elementPositioning == 'absolute') {
        if (this.options.scaleY) d.top = this.originalTop-topd + 'px';
        if (this.options.scaleX) d.left = this.originalLeft-leftd + 'px';
      } else {
        if (this.options.scaleY) d.top = -topd + 'px';
        if (this.options.scaleX) d.left = -leftd + 'px';
      }
    }
    this.element.setStyle(d);
  }
});

Effect.Highlight = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({ startcolor: '#ffff99' }, arguments[1] || { });
    this.start(options);
  },
  setup: function() {
    // Prevent executing on elements not in the layout flow
    if (this.element.getStyle('display')=='none') { this.cancel(); return; }
    // Disable background image during the effect
    this.oldStyle = { };
    if (!this.options.keepBackgroundImage) {
      this.oldStyle.backgroundImage = this.element.getStyle('background-image');
      this.element.setStyle({backgroundImage: 'none'});
    }
    if (!this.options.endcolor)
      this.options.endcolor = this.element.getStyle('background-color').parseColor('#ffffff');
    if (!this.options.restorecolor)
      this.options.restorecolor = this.element.getStyle('background-color');
    // init color calculations
    this._base  = $R(0,2).map(function(i){ return parseInt(this.options.startcolor.slice(i*2+1,i*2+3),16) }.bind(this));
    this._delta = $R(0,2).map(function(i){ return parseInt(this.options.endcolor.slice(i*2+1,i*2+3),16)-this._base[i] }.bind(this));
  },
  update: function(position) {
    this.element.setStyle({backgroundColor: $R(0,2).inject('#',function(m,v,i){
      return m+((this._base[i]+(this._delta[i]*position)).round().toColorPart()); }.bind(this)) });
  },
  finish: function() {
    this.element.setStyle(Object.extend(this.oldStyle, {
      backgroundColor: this.options.restorecolor
    }));
  }
});

Effect.ScrollTo = function(element) {
  var options = arguments[1] || { },
  scrollOffsets = document.viewport.getScrollOffsets(),
  elementOffsets = $(element).cumulativeOffset();

  if (options.offset) elementOffsets[1] += options.offset;

  return new Effect.Tween(null,
    scrollOffsets.top,
    elementOffsets[1],
    options,
    function(p){ scrollTo(scrollOffsets.left, p.round()); }
  );
};

/* ------------- combination effects ------------- */

Effect.Fade = function(element) {
  element = $(element);
  var oldOpacity = element.getInlineOpacity();
  var options = Object.extend({
    from: element.getOpacity() || 1.0,
    to:   0.0,
    afterFinishInternal: function(effect) {
      if (effect.options.to!=0) return;
      effect.element.hide().setStyle({opacity: oldOpacity});
    }
  }, arguments[1] || { });
  return new Effect.Opacity(element,options);
};

Effect.Appear = function(element) {
  element = $(element);
  var options = Object.extend({
  from: (element.getStyle('display') == 'none' ? 0.0 : element.getOpacity() || 0.0),
  to:   1.0,
  // force Safari to render floated elements properly
  afterFinishInternal: function(effect) {
    effect.element.forceRerendering();
  },
  beforeSetup: function(effect) {
    effect.element.setOpacity(effect.options.from).show();
  }}, arguments[1] || { });
  return new Effect.Opacity(element,options);
};

Effect.Puff = function(element) {
  element = $(element);
  var oldStyle = {
    opacity: element.getInlineOpacity(),
    position: element.getStyle('position'),
    top:  element.style.top,
    left: element.style.left,
    width: element.style.width,
    height: element.style.height
  };
  return new Effect.Parallel(
   [ new Effect.Scale(element, 200,
      { sync: true, scaleFromCenter: true, scaleContent: true, restoreAfterFinish: true }),
     new Effect.Opacity(element, { sync: true, to: 0.0 } ) ],
     Object.extend({ duration: 1.0,
      beforeSetupInternal: function(effect) {
        Position.absolutize(effect.effects[0].element);
      },
      afterFinishInternal: function(effect) {
         effect.effects[0].element.hide().setStyle(oldStyle); }
     }, arguments[1] || { })
   );
};

Effect.BlindUp = function(element) {
  element = $(element);
  element.makeClipping();
  return new Effect.Scale(element, 0,
    Object.extend({ scaleContent: false,
      scaleX: false,
      restoreAfterFinish: true,
      afterFinishInternal: function(effect) {
        effect.element.hide().undoClipping();
      }
    }, arguments[1] || { })
  );
};

Effect.BlindDown = function(element) {
  element = $(element);
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, 100, Object.extend({
    scaleContent: false,
    scaleX: false,
    scaleFrom: 0,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makeClipping().setStyle({height: '0px'}).show();
    },
    afterFinishInternal: function(effect) {
      effect.element.undoClipping();
    }
  }, arguments[1] || { }));
};

Effect.SwitchOff = function(element) {
  element = $(element);
  var oldOpacity = element.getInlineOpacity();
  return new Effect.Appear(element, Object.extend({
    duration: 0.4,
    from: 0,
    transition: Effect.Transitions.flicker,
    afterFinishInternal: function(effect) {
      new Effect.Scale(effect.element, 1, {
        duration: 0.3, scaleFromCenter: true,
        scaleX: false, scaleContent: false, restoreAfterFinish: true,
        beforeSetup: function(effect) {
          effect.element.makePositioned().makeClipping();
        },
        afterFinishInternal: function(effect) {
          effect.element.hide().undoClipping().undoPositioned().setStyle({opacity: oldOpacity});
        }
      });
    }
  }, arguments[1] || { }));
};

Effect.DropOut = function(element) {
  element = $(element);
  var oldStyle = {
    top: element.getStyle('top'),
    left: element.getStyle('left'),
    opacity: element.getInlineOpacity() };
  return new Effect.Parallel(
    [ new Effect.Move(element, {x: 0, y: 100, sync: true }),
      new Effect.Opacity(element, { sync: true, to: 0.0 }) ],
    Object.extend(
      { duration: 0.5,
        beforeSetup: function(effect) {
          effect.effects[0].element.makePositioned();
        },
        afterFinishInternal: function(effect) {
          effect.effects[0].element.hide().undoPositioned().setStyle(oldStyle);
        }
      }, arguments[1] || { }));
};

Effect.Shake = function(element) {
  element = $(element);
  var options = Object.extend({
    distance: 20,
    duration: 0.5
  }, arguments[1] || {});
  var distance = parseFloat(options.distance);
  var split = parseFloat(options.duration) / 10.0;
  var oldStyle = {
    top: element.getStyle('top'),
    left: element.getStyle('left') };
    return new Effect.Move(element,
      { x:  distance, y: 0, duration: split, afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x:  distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x:  distance*2, y: 0, duration: split*2,  afterFinishInternal: function(effect) {
    new Effect.Move(effect.element,
      { x: -distance, y: 0, duration: split, afterFinishInternal: function(effect) {
        effect.element.undoPositioned().setStyle(oldStyle);
  }}); }}); }}); }}); }}); }});
};

Effect.SlideDown = function(element) {
  element = $(element).cleanWhitespace();
  // SlideDown need to have the content of the element wrapped in a container element with fixed height!
  var oldInnerBottom = element.down().getStyle('bottom');
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, 100, Object.extend({
    scaleContent: false,
    scaleX: false,
    scaleFrom: window.opera ? 0 : 1,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makePositioned();
      effect.element.down().makePositioned();
      if (window.opera) effect.element.setStyle({top: ''});
      effect.element.makeClipping().setStyle({height: '0px'}).show();
    },
    afterUpdateInternal: function(effect) {
      effect.element.down().setStyle({bottom:
        (effect.dims[0] - effect.element.clientHeight) + 'px' });
    },
    afterFinishInternal: function(effect) {
      effect.element.undoClipping().undoPositioned();
      effect.element.down().undoPositioned().setStyle({bottom: oldInnerBottom}); }
    }, arguments[1] || { })
  );
};

Effect.SlideUp = function(element) {
  element = $(element).cleanWhitespace();
  var oldInnerBottom = element.down().getStyle('bottom');
  var elementDimensions = element.getDimensions();
  return new Effect.Scale(element, window.opera ? 0 : 1,
   Object.extend({ scaleContent: false,
    scaleX: false,
    scaleMode: 'box',
    scaleFrom: 100,
    scaleMode: {originalHeight: elementDimensions.height, originalWidth: elementDimensions.width},
    restoreAfterFinish: true,
    afterSetup: function(effect) {
      effect.element.makePositioned();
      effect.element.down().makePositioned();
      if (window.opera) effect.element.setStyle({top: ''});
      effect.element.makeClipping().show();
    },
    afterUpdateInternal: function(effect) {
      effect.element.down().setStyle({bottom:
        (effect.dims[0] - effect.element.clientHeight) + 'px' });
    },
    afterFinishInternal: function(effect) {
      effect.element.hide().undoClipping().undoPositioned();
      effect.element.down().undoPositioned().setStyle({bottom: oldInnerBottom});
    }
   }, arguments[1] || { })
  );
};

// Bug in opera makes the TD containing this element expand for a instance after finish
Effect.Squish = function(element) {
  return new Effect.Scale(element, window.opera ? 1 : 0, {
    restoreAfterFinish: true,
    beforeSetup: function(effect) {
      effect.element.makeClipping();
    },
    afterFinishInternal: function(effect) {
      effect.element.hide().undoClipping();
    }
  });
};

Effect.Grow = function(element) {
  element = $(element);
  var options = Object.extend({
    direction: 'center',
    moveTransition: Effect.Transitions.sinoidal,
    scaleTransition: Effect.Transitions.sinoidal,
    opacityTransition: Effect.Transitions.full
  }, arguments[1] || { });
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    height: element.style.height,
    width: element.style.width,
    opacity: element.getInlineOpacity() };

  var dims = element.getDimensions();
  var initialMoveX, initialMoveY;
  var moveX, moveY;

  switch (options.direction) {
    case 'top-left':
      initialMoveX = initialMoveY = moveX = moveY = 0;
      break;
    case 'top-right':
      initialMoveX = dims.width;
      initialMoveY = moveY = 0;
      moveX = -dims.width;
      break;
    case 'bottom-left':
      initialMoveX = moveX = 0;
      initialMoveY = dims.height;
      moveY = -dims.height;
      break;
    case 'bottom-right':
      initialMoveX = dims.width;
      initialMoveY = dims.height;
      moveX = -dims.width;
      moveY = -dims.height;
      break;
    case 'center':
      initialMoveX = dims.width / 2;
      initialMoveY = dims.height / 2;
      moveX = -dims.width / 2;
      moveY = -dims.height / 2;
      break;
  }

  return new Effect.Move(element, {
    x: initialMoveX,
    y: initialMoveY,
    duration: 0.01,
    beforeSetup: function(effect) {
      effect.element.hide().makeClipping().makePositioned();
    },
    afterFinishInternal: function(effect) {
      new Effect.Parallel(
        [ new Effect.Opacity(effect.element, { sync: true, to: 1.0, from: 0.0, transition: options.opacityTransition }),
          new Effect.Move(effect.element, { x: moveX, y: moveY, sync: true, transition: options.moveTransition }),
          new Effect.Scale(effect.element, 100, {
            scaleMode: { originalHeight: dims.height, originalWidth: dims.width },
            sync: true, scaleFrom: window.opera ? 1 : 0, transition: options.scaleTransition, restoreAfterFinish: true})
        ], Object.extend({
             beforeSetup: function(effect) {
               effect.effects[0].element.setStyle({height: '0px'}).show();
             },
             afterFinishInternal: function(effect) {
               effect.effects[0].element.undoClipping().undoPositioned().setStyle(oldStyle);
             }
           }, options)
      );
    }
  });
};

Effect.Shrink = function(element) {
  element = $(element);
  var options = Object.extend({
    direction: 'center',
    moveTransition: Effect.Transitions.sinoidal,
    scaleTransition: Effect.Transitions.sinoidal,
    opacityTransition: Effect.Transitions.none
  }, arguments[1] || { });
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    height: element.style.height,
    width: element.style.width,
    opacity: element.getInlineOpacity() };

  var dims = element.getDimensions();
  var moveX, moveY;

  switch (options.direction) {
    case 'top-left':
      moveX = moveY = 0;
      break;
    case 'top-right':
      moveX = dims.width;
      moveY = 0;
      break;
    case 'bottom-left':
      moveX = 0;
      moveY = dims.height;
      break;
    case 'bottom-right':
      moveX = dims.width;
      moveY = dims.height;
      break;
    case 'center':
      moveX = dims.width / 2;
      moveY = dims.height / 2;
      break;
  }

  return new Effect.Parallel(
    [ new Effect.Opacity(element, { sync: true, to: 0.0, from: 1.0, transition: options.opacityTransition }),
      new Effect.Scale(element, window.opera ? 1 : 0, { sync: true, transition: options.scaleTransition, restoreAfterFinish: true}),
      new Effect.Move(element, { x: moveX, y: moveY, sync: true, transition: options.moveTransition })
    ], Object.extend({
         beforeStartInternal: function(effect) {
           effect.effects[0].element.makePositioned().makeClipping();
         },
         afterFinishInternal: function(effect) {
           effect.effects[0].element.hide().undoClipping().undoPositioned().setStyle(oldStyle); }
       }, options)
  );
};

Effect.Pulsate = function(element) {
  element = $(element);
  var options    = arguments[1] || { },
    oldOpacity = element.getInlineOpacity(),
    transition = options.transition || Effect.Transitions.linear,
    reverser   = function(pos){
      return 1 - transition((-Math.cos((pos*(options.pulses||5)*2)*Math.PI)/2) + .5);
    };

  return new Effect.Opacity(element,
    Object.extend(Object.extend({  duration: 2.0, from: 0,
      afterFinishInternal: function(effect) { effect.element.setStyle({opacity: oldOpacity}); }
    }, options), {transition: reverser}));
};

Effect.Fold = function(element) {
  element = $(element);
  var oldStyle = {
    top: element.style.top,
    left: element.style.left,
    width: element.style.width,
    height: element.style.height };
  element.makeClipping();
  return new Effect.Scale(element, 5, Object.extend({
    scaleContent: false,
    scaleX: false,
    afterFinishInternal: function(effect) {
    new Effect.Scale(element, 1, {
      scaleContent: false,
      scaleY: false,
      afterFinishInternal: function(effect) {
        effect.element.hide().undoClipping().setStyle(oldStyle);
      } });
  }}, arguments[1] || { }));
};

Effect.Morph = Class.create(Effect.Base, {
  initialize: function(element) {
    this.element = $(element);
    if (!this.element) throw(Effect._elementDoesNotExistError);
    var options = Object.extend({
      style: { }
    }, arguments[1] || { });

    if (!Object.isString(options.style)) this.style = $H(options.style);
    else {
      if (options.style.include(':'))
        this.style = options.style.parseStyle();
      else {
        this.element.addClassName(options.style);
        this.style = $H(this.element.getStyles());
        this.element.removeClassName(options.style);
        var css = this.element.getStyles();
        this.style = this.style.reject(function(style) {
          return style.value == css[style.key];
        });
        options.afterFinishInternal = function(effect) {
          effect.element.addClassName(effect.options.style);
          effect.transforms.each(function(transform) {
            effect.element.style[transform.style] = '';
          });
        };
      }
    }
    this.start(options);
  },

  setup: function(){
    function parseColor(color){
      if (!color || ['rgba(0, 0, 0, 0)','transparent'].include(color)) color = '#ffffff';
      color = color.parseColor();
      return $R(0,2).map(function(i){
        return parseInt( color.slice(i*2+1,i*2+3), 16 );
      });
    }
    this.transforms = this.style.map(function(pair){
      var property = pair[0], value = pair[1], unit = null;

      if (value.parseColor('#zzzzzz') != '#zzzzzz') {
        value = value.parseColor();
        unit  = 'color';
      } else if (property == 'opacity') {
        value = parseFloat(value);
        if (Prototype.Browser.IE && (!this.element.currentStyle.hasLayout))
          this.element.setStyle({zoom: 1});
      } else if (Element.CSS_LENGTH.test(value)) {
          var components = value.match(/^([\+\-]?[0-9\.]+)(.*)$/);
          value = parseFloat(components[1]);
          unit = (components.length == 3) ? components[2] : null;
      }

      var originalValue = this.element.getStyle(property);
      return {
        style: property.camelize(),
        originalValue: unit=='color' ? parseColor(originalValue) : parseFloat(originalValue || 0),
        targetValue: unit=='color' ? parseColor(value) : value,
        unit: unit
      };
    }.bind(this)).reject(function(transform){
      return (
        (transform.originalValue == transform.targetValue) ||
        (
          transform.unit != 'color' &&
          (isNaN(transform.originalValue) || isNaN(transform.targetValue))
        )
      );
    });
  },
  update: function(position) {
    var style = { }, transform, i = this.transforms.length;
    while(i--)
      style[(transform = this.transforms[i]).style] =
        transform.unit=='color' ? '#'+
          (Math.round(transform.originalValue[0]+
            (transform.targetValue[0]-transform.originalValue[0])*position)).toColorPart() +
          (Math.round(transform.originalValue[1]+
            (transform.targetValue[1]-transform.originalValue[1])*position)).toColorPart() +
          (Math.round(transform.originalValue[2]+
            (transform.targetValue[2]-transform.originalValue[2])*position)).toColorPart() :
        (transform.originalValue +
          (transform.targetValue - transform.originalValue) * position).toFixed(3) +
            (transform.unit === null ? '' : transform.unit);
    this.element.setStyle(style, true);
  }
});

Effect.Transform = Class.create({
  initialize: function(tracks){
    this.tracks  = [];
    this.options = arguments[1] || { };
    this.addTracks(tracks);
  },
  addTracks: function(tracks){
    tracks.each(function(track){
      track = $H(track);
      var data = track.values().first();
      this.tracks.push($H({
        ids:     track.keys().first(),
        effect:  Effect.Morph,
        options: { style: data }
      }));
    }.bind(this));
    return this;
  },
  play: function(){
    return new Effect.Parallel(
      this.tracks.map(function(track){
        var ids = track.get('ids'), effect = track.get('effect'), options = track.get('options');
        var elements = [$(ids) || $$(ids)].flatten();
        return elements.map(function(e){ return new effect(e, Object.extend({ sync:true }, options)) });
      }).flatten(),
      this.options
    );
  }
});

Element.CSS_PROPERTIES = $w(
  'backgroundColor backgroundPosition borderBottomColor borderBottomStyle ' +
  'borderBottomWidth borderLeftColor borderLeftStyle borderLeftWidth ' +
  'borderRightColor borderRightStyle borderRightWidth borderSpacing ' +
  'borderTopColor borderTopStyle borderTopWidth bottom clip color ' +
  'fontSize fontWeight height left letterSpacing lineHeight ' +
  'marginBottom marginLeft marginRight marginTop markerOffset maxHeight '+
  'maxWidth minHeight minWidth opacity outlineColor outlineOffset ' +
  'outlineWidth paddingBottom paddingLeft paddingRight paddingTop ' +
  'right textIndent top width wordSpacing zIndex');

Element.CSS_LENGTH = /^(([\+\-]?[0-9\.]+)(em|ex|px|in|cm|mm|pt|pc|\%))|0$/;

String.__parseStyleElement = document.createElement('div');
String.prototype.parseStyle = function(){
  var style, styleRules = $H();
  if (Prototype.Browser.WebKit)
    style = new Element('div',{style:this}).style;
  else {
    String.__parseStyleElement.innerHTML = '<div style="' + this + '"></div>';
    style = String.__parseStyleElement.childNodes[0].style;
  }

  Element.CSS_PROPERTIES.each(function(property){
    if (style[property]) styleRules.set(property, style[property]);
  });

  if (Prototype.Browser.IE && this.include('opacity'))
    styleRules.set('opacity', this.match(/opacity:\s*((?:0|1)?(?:\.\d*)?)/)[1]);

  return styleRules;
};

if (document.defaultView && document.defaultView.getComputedStyle) {
  Element.getStyles = function(element) {
    var css = document.defaultView.getComputedStyle($(element), null);
    return Element.CSS_PROPERTIES.inject({ }, function(styles, property) {
      styles[property] = css[property];
      return styles;
    });
  };
} else {
  Element.getStyles = function(element) {
    element = $(element);
    var css = element.currentStyle, styles;
    styles = Element.CSS_PROPERTIES.inject({ }, function(results, property) {
      results[property] = css[property];
      return results;
    });
    if (!styles.opacity) styles.opacity = element.getOpacity();
    return styles;
  };
}

Effect.Methods = {
  morph: function(element, style) {
    element = $(element);
    new Effect.Morph(element, Object.extend({ style: style }, arguments[2] || { }));
    return element;
  },
  visualEffect: function(element, effect, options) {
    element = $(element);
    var s = effect.dasherize().camelize(), klass = s.charAt(0).toUpperCase() + s.substring(1);
    new Effect[klass](element, options);
    return element;
  },
  highlight: function(element, options) {
    element = $(element);
    new Effect.Highlight(element, options);
    return element;
  }
};

$w('fade appear grow shrink fold blindUp blindDown slideUp slideDown '+
  'pulsate shake puff squish switchOff dropOut').each(
  function(effect) {
    Effect.Methods[effect] = function(element, options){
      element = $(element);
      Effect[effect.charAt(0).toUpperCase() + effect.substring(1)](element, options);
      return element;
    };
  }
);

$w('getInlineOpacity forceRerendering setContentZoom collectTextNodes collectTextNodesIgnoreClass getStyles').each(
  function(f) { Effect.Methods[f] = Element[f]; }
);

Element.addMethods(Effect.Methods);
(function(){function h(a){this.t={};this.tick=function(a,c,d){d=d?d:(new Date).getTime();this.t[a]=[d,c]};this.tick("start",null,a)}var k=new h;window.GA_jstiming={Timer:h,load:k};if(window.GA_jstiming){window.GA_jstiming.d={};window.GA_jstiming.i=1;var l=function(a,b,c){var d=a.t[b],e=a.t.start;if(d&&(e||c))return d=a.t[b][0],e=void 0!=c?c:e[0],d-e};window.GA_jstiming.report=function(a,b,c){var d="";a.h&&(d+="&"+a.h);var e=a.t,g=e.start,u=[],n=[],f;for(f in e)if("start"!=f&&0!=f.indexOf("_")){var p=e[f][1];p?e[p]&&n.push(f+"."+l(a,f,e[p][0])):g&&u.push(f+"."+l(a,f))}delete e.start;if(b)for(var v in b)d+="&"+v+"="+b[v];a=[c?c:"{{SCHEME}}//csi.gstatic.com/csi","?v=3","&s="+
(window.GA_jstiming.sn||"gam")+"&action=",a.name,n.length?"&it="+n.join(","):"","",d,"&rt=",u.join(",")].join("");b=new Image;var w=window.GA_jstiming.i++;window.GA_jstiming.d[w]=b;b.onload=b.onerror=function(){delete window.GA_jstiming.d[w]};b.src=a;b=null;return a}};var m=this,q=function(a,b){var c,d=b,e=a.split(".");c=c||m;e[0]in c||!c.execScript||c.execScript("var "+e[0]);for(var g;e.length&&(g=e.shift());)e.length||void 0===d?c=c[g]?c[g]:c[g]={}:c[g]=d},s=function(a){var b=r;function c(){}c.prototype=b.prototype;a.k=b.prototype;a.prototype=new c};var t=/^([\w-]+\.)*([\w-]{2,})(\:[0-9]+)?$/,x=function(a,b){if(!a)return b;var c=a.match(t);return c?c[0]:b};var y,z="false",A=!1,B=y=/^true$/.test(z)?!0:/^false$/.test(z)?!1:A;var C=function(){return x("","pubads.g.doubleclick.net")};var D;D||x("","pagead2.googlesyndication.com");var E=function(a,b){for(var c in a)Object.prototype.hasOwnProperty.call(a,c)&&b.call(null,a[c],c,a)};var F=function(a){this.c=[];this.b={};for(var b=0,c=arguments.length;b<c;++b)this.b[arguments[b]]=""};F.prototype.j=function(a){return this.b.hasOwnProperty(a)?this.b[a]:""};F.prototype.geil=F.prototype.j;var G=function(a){var b=[],c=function(a){""!=a&&b.push(a)};E(a.b,c);return 0<a.c.length&&0<b.length?a.c.join(",")+","+b.join(","):a.c.join(",")+b.join(",")};function H(a){var b="adsense";if(a&&"string"==typeof a&&0<a.length&&null!=b){var c=window.GS_googleServiceIds_[b];null==c&&(c="adsense"==b?new I:new J,window.GS_googleServiceIds_[b]=c);t:{for(b=0;b<c.a.length;b++)if(a==c.a[b])break t;c.a[c.a.length]=a}a=c}else a=null;return a}q("GS_googleAddAdSenseService",H);function K(){for(var a in window.GS_googleServiceIds_){var b=window.GS_googleServiceIds_[a];"function"!=typeof b&&b.enable()}}q("GS_googleEnableAllServices",K);
function L(){window.GS_googleServiceIds_={}}q("GS_googleResetAllServices",L);function M(){var a;a="adsense";a=null==a?null:window.GS_googleServiceIds_[a];return a=null==a?"":a.a.join()}q("GS_googleGetIdsForAdSenseService",M);function N(a){return O(a)}q("GS_googleFindService",N);function P(){var a=O("adsense");return a?G(a.g):""}q("GS_googleGetExpIdsForAdSense",P);function r(a){this.f=a;this.a=[];this.g=new F}
r.prototype.toString=function(){for(var a="["+this.f+" ids: ",b=0;b<this.a.length;b++)0<b&&(a+=","),a+=this.a[b];return a+="]"};var O=function(a){return a=null==a?null:window.GS_googleServiceIds_[a]};function J(){r.call(this,"unknown")}s(J);J.prototype.enable=function(){};function I(){r.call(this,"adsense");this.e=!1}s(I);
I.prototype.enable=function(){if(!this.e){var a;a=(a=document.URL)&&(0<a.indexOf("?google_debug")||0<a.indexOf("&google_debug"))?"google_ads_dbg.js":"google_ads.js";var b="http://"+x("","partner.googleadservices.com");B&&(b="https://"+x("","securepubads.g.doubleclick.net"));var c="",d;d=C();(d="pubads.g.doubleclick.net"==d)||(c="?prodhost="+C());a=b+"/gampad/"+a+c;b="script";document.write("<"+b+' src="'+a+'">\x3c/script>');this.e=!0;window.GA_jstiming&&
window.GA_jstiming.Timer&&(window.GA_jstiming.load.name="load",window.GA_jstiming.load.tick("start"))}};window.GS_googleServiceIds_||(window.GS_googleServiceIds_={});})()

// Flash Player Version Detection - Rev 1.5
// Detect Client Browser type
// Copyright(c) 2005-2006 Adobe Macromedia Software, LLC. All rights reserved.
var isIE  = (navigator.appVersion.indexOf("MSIE") != -1) ? true : false;
var isWin = (navigator.appVersion.toLowerCase().indexOf("win") != -1) ? true : false;
var isOpera = (navigator.userAgent.indexOf("Opera") != -1) ? true : false;

function ControlVersion()
{
	var version;
	var axo;
	var e;

	// NOTE : new ActiveXObject(strFoo) throws an exception if strFoo isn't in the registry

	try {
		// version will be set for 7.X or greater players
		axo = new ActiveXObject("ShockwaveFlash.ShockwaveFlash.7");
		version = axo.GetVariable("$version");
	} catch (e) {
	}

	if (!version)
	{
		try {
			// version will be set for 6.X players only
			axo = new ActiveXObject("ShockwaveFlash.ShockwaveFlash.6");
			
			// installed player is some revision of 6.0
			// GetVariable("$version") crashes for versions 6.0.22 through 6.0.29,
			// so we have to be careful. 
			
			// default to the first public version
			version = "WIN 6,0,21,0";

			// throws if AllowScripAccess does not exist (introduced in 6.0r47)		
			axo.AllowScriptAccess = "always";

			// safe to call for 6.0r47 or greater
			version = axo.GetVariable("$version");

		} catch (e) {
		}
	}

	if (!version)
	{
		try {
			// version will be set for 4.X or 5.X player
			axo = new ActiveXObject("ShockwaveFlash.ShockwaveFlash.3");
			version = axo.GetVariable("$version");
		} catch (e) {
		}
	}

	if (!version)
	{
		try {
			// version will be set for 3.X player
			axo = new ActiveXObject("ShockwaveFlash.ShockwaveFlash.3");
			version = "WIN 3,0,18,0";
		} catch (e) {
		}
	}

	if (!version)
	{
		try {
			// version will be set for 2.X player
			axo = new ActiveXObject("ShockwaveFlash.ShockwaveFlash");
			version = "WIN 2,0,0,11";
		} catch (e) {
			version = -1;
		}
	}
	
	return version;
}

// JavaScript helper required to detect Flash Player PlugIn version information
function GetSwfVer(){
	// NS/Opera version >= 3 check for Flash plugin in plugin array
	var flashVer = -1;
	
	if (navigator.plugins != null && navigator.plugins.length > 0) {
		if (navigator.plugins["Shockwave Flash 2.0"] || navigator.plugins["Shockwave Flash"]) {
			var swVer2 = navigator.plugins["Shockwave Flash 2.0"] ? " 2.0" : "";
			var flashDescription = navigator.plugins["Shockwave Flash" + swVer2].description;			
			var descArray = flashDescription.split(" ");
			var tempArrayMajor = descArray[2].split(".");
			var versionMajor = tempArrayMajor[0];
			var versionMinor = tempArrayMajor[1];
			if ( descArray[3] != "" ) {
				tempArrayMinor = descArray[3].split("r");
			} else {
				tempArrayMinor = descArray[4].split("r");
			}
			var versionRevision = tempArrayMinor[1] > 0 ? tempArrayMinor[1] : 0;
			var flashVer = versionMajor + "." + versionMinor + "." + versionRevision;
		}
	}
	// MSN/WebTV 2.6 supports Flash 4
	else if (navigator.userAgent.toLowerCase().indexOf("webtv/2.6") != -1) flashVer = 4;
	// WebTV 2.5 supports Flash 3
	else if (navigator.userAgent.toLowerCase().indexOf("webtv/2.5") != -1) flashVer = 3;
	// older WebTV supports Flash 2
	else if (navigator.userAgent.toLowerCase().indexOf("webtv") != -1) flashVer = 2;
	else if ( isIE && isWin && !isOpera ) {
		flashVer = ControlVersion();
	}	
	return flashVer;
}

// When called with reqMajorVer, reqMinorVer, reqRevision returns true if that version or greater is available
function DetectFlashVer(reqMajorVer, reqMinorVer, reqRevision)
{
	versionStr = GetSwfVer();
	if (versionStr == -1 ) {
		return false;
	} else if (versionStr != 0) {
		if(isIE && isWin && !isOpera) {
			// Given "WIN 2,0,0,11"
			tempArray         = versionStr.split(" "); 	// ["WIN", "2,0,0,11"]
			tempString        = tempArray[1];			// "2,0,0,11"
			versionArray      = tempString.split(",");	// ['2', '0', '0', '11']
		} else {
			versionArray      = versionStr.split(".");
		}
		var versionMajor      = versionArray[0];
		var versionMinor      = versionArray[1];
		var versionRevision   = versionArray[2];

        	// is the major.revision >= requested major.revision AND the minor version >= requested minor
		if (versionMajor > parseFloat(reqMajorVer)) {
			return true;
		} else if (versionMajor == parseFloat(reqMajorVer)) {
			if (versionMinor > parseFloat(reqMinorVer))
				return true;
			else if (versionMinor == parseFloat(reqMinorVer)) {
				if (versionRevision >= parseFloat(reqRevision))
					return true;
			}
		}
		return false;
	}
}

function AC_AddExtension(src, ext)
{
  if (src.indexOf('?') != -1)
    return src.replace(/\?/, ext+'?'); 
  else
    return src + ext;
}

function AC_Generateobj(objAttrs, params, embedAttrs) 
{ 
    var str = '';
    if (isIE && isWin && !isOpera)
    {
  		str += '<object ';
  		for (var i in objAttrs)
  			str += i + '="' + objAttrs[i] + '" ';
  		for (var i in params)
  			str += '><param name="' + i + '" value="' + params[i] + '" /> ';
  		str += '></object>';
    } else {
  		str += '<embed ';
  		for (var i in embedAttrs)
  			str += i + '="' + embedAttrs[i] + '" ';
  		str += '> </embed>';
    }

    document.write(str);
}

function AC_FL_RunContent(){
  var ret = 
    AC_GetArgs
    (  arguments, ".swf", "movie", "clsid:d27cdb6e-ae6d-11cf-96b8-444553540000"
     , "application/x-shockwave-flash"
    );
  AC_Generateobj(ret.objAttrs, ret.params, ret.embedAttrs);
}

function AC_GetArgs(args, ext, srcParamName, classid, mimeType){
  var ret = new Object();
  ret.embedAttrs = new Object();
  ret.params = new Object();
  ret.objAttrs = new Object();
  for (var i=0; i < args.length; i=i+2){
    var currArg = args[i].toLowerCase();    

    switch (currArg){	
      case "classid":
        break;
      case "pluginspage":
        ret.embedAttrs[args[i]] = args[i+1];
        break;
      case "src":
      case "movie":	
        args[i+1] = AC_AddExtension(args[i+1], ext);
        ret.embedAttrs["src"] = args[i+1];
        ret.params[srcParamName] = args[i+1];
        break;
      case "onafterupdate":
      case "onbeforeupdate":
      case "onblur":
      case "oncellchange":
      case "onclick":
      case "ondblClick":
      case "ondrag":
      case "ondragend":
      case "ondragenter":
      case "ondragleave":
      case "ondragover":
      case "ondrop":
      case "onfinish":
      case "onfocus":
      case "onhelp":
      case "onmousedown":
      case "onmouseup":
      case "onmouseover":
      case "onmousemove":
      case "onmouseout":
      case "onkeypress":
      case "onkeydown":
      case "onkeyup":
      case "onload":
      case "onlosecapture":
      case "onpropertychange":
      case "onreadystatechange":
      case "onrowsdelete":
      case "onrowenter":
      case "onrowexit":
      case "onrowsinserted":
      case "onstart":
      case "onscroll":
      case "onbeforeeditfocus":
      case "onactivate":
      case "onbeforedeactivate":
      case "ondeactivate":
      case "type":
      case "codebase":
      case "id":
        ret.objAttrs[args[i]] = args[i+1];
        break;
      case "width":
      case "height":
      case "align":
      case "vspace": 
      case "hspace":
      case "class":
      case "title":
      case "accesskey":
      case "name":
      case "tabindex":
        ret.embedAttrs[args[i]] = ret.objAttrs[args[i]] = args[i+1];
        break;
      default:
        ret.embedAttrs[args[i]] = ret.params[args[i]] = args[i+1];
    }
  }
  ret.objAttrs["classid"] = classid;
  if (mimeType) ret.embedAttrs["type"] = mimeType;
  return ret;
}



// script.aculo.us controls.js v1.8.3, Thu Oct 08 11:23:33 +0200 2009

// Copyright (c) 2005-2009 Thomas Fuchs (http://script.aculo.us, http://mir.aculo.us)
//           (c) 2005-2009 Ivan Krstic (http://blogs.law.harvard.edu/ivan)
//           (c) 2005-2009 Jon Tirsen (http://www.tirsen.com)
// Contributors:
//  Richard Livsey
//  Rahul Bhargava
//  Rob Wills
//
// script.aculo.us is freely distributable under the terms of an MIT-style license.
// For details, see the script.aculo.us web site: http://script.aculo.us/

// Autocompleter.Base handles all the autocompletion functionality
// that's independent of the data source for autocompletion. This
// includes drawing the autocompletion menu, observing keyboard
// and mouse events, and similar.
//
// Specific autocompleters need to provide, at the very least,
// a getUpdatedChoices function that will be invoked every time
// the text inside the monitored textbox changes. This method
// should get the text for which to provide autocompletion by
// invoking this.getToken(), NOT by directly accessing
// this.element.value. This is to allow incremental tokenized
// autocompletion. Specific auto-completion logic (AJAX, etc)
// belongs in getUpdatedChoices.
//
// Tokenized incremental autocompletion is enabled automatically
// when an autocompleter is instantiated with the 'tokens' option
// in the options parameter, e.g.:
// new Ajax.Autocompleter('id','upd', '/url/', { tokens: ',' });
// will incrementally autocomplete with a comma as the token.
// Additionally, ',' in the above example can be replaced with
// a token array, e.g. { tokens: [',', '\n'] } which
// enables autocompletion on multiple tokens. This is most
// useful when one of the tokens is \n (a newline), as it
// allows smart autocompletion after linebreaks.

if(typeof Effect == 'undefined')
  throw("controls.js requires including script.aculo.us' effects.js library");

var Autocompleter = { };
Autocompleter.Base = Class.create({
  baseInitialize: function(element, update, options) {
    element          = $(element);
    this.element     = element;
    this.update      = $(update);
    this.hasFocus    = false;
    this.changed     = false;
    this.active      = false;
    this.index       = 0;
    this.entryCount  = 0;
    this.oldElementValue = this.element.value;

    if(this.setOptions)
      this.setOptions(options);
    else
      this.options = options || { };

    this.options.paramName    = this.options.paramName || this.element.name;
    this.options.tokens       = this.options.tokens || [];
    this.options.frequency    = this.options.frequency || 0.4;
    this.options.minChars     = this.options.minChars || 1;
    this.options.onShow       = this.options.onShow ||
      function(element, update){
        if(!update.style.position || update.style.position=='absolute') {
          update.style.position = 'absolute';
          Position.clone(element, update, {
            setHeight: false,
            offsetTop: element.offsetHeight
          });
        }
        Effect.Appear(update,{duration:0.15});
      };
    this.options.onHide = this.options.onHide ||
      function(element, update){ new Effect.Fade(update,{duration:0.15}) };

    if(typeof(this.options.tokens) == 'string')
      this.options.tokens = new Array(this.options.tokens);
    // Force carriage returns as token delimiters anyway
    if (!this.options.tokens.include('\n'))
      this.options.tokens.push('\n');

    this.observer = null;

    this.element.setAttribute('autocomplete','off');

    Element.hide(this.update);

    Event.observe(this.element, 'blur', this.onBlur.bindAsEventListener(this));
    Event.observe(this.element, 'keydown', this.onKeyPress.bindAsEventListener(this));
  },

  show: function() {
    if(Element.getStyle(this.update, 'display')=='none') this.options.onShow(this.element, this.update);
    if(!this.iefix &&
      (Prototype.Browser.IE) &&
      (Element.getStyle(this.update, 'position')=='absolute')) {
      new Insertion.After(this.update,
       '<iframe id="' + this.update.id + '_iefix" '+
       'style="display:none;position:absolute;filter:progid:DXImageTransform.Microsoft.Alpha(opacity=0);" ' +
       'src="javascript:false;" frameborder="0" scrolling="no"></iframe>');
      this.iefix = $(this.update.id+'_iefix');
    }
    if(this.iefix) setTimeout(this.fixIEOverlapping.bind(this), 50);
  },

  fixIEOverlapping: function() {
    Position.clone(this.update, this.iefix, {setTop:(!this.update.style.height)});
    this.iefix.style.zIndex = 1;
    this.update.style.zIndex = 2;
    Element.show(this.iefix);
  },

  hide: function() {
    this.stopIndicator();
    if(Element.getStyle(this.update, 'display')!='none') this.options.onHide(this.element, this.update);
    if(this.iefix) Element.hide(this.iefix);
  },

  startIndicator: function() {
    if(this.options.indicator) Element.show(this.options.indicator);
  },

  stopIndicator: function() {
    if(this.options.indicator) Element.hide(this.options.indicator);
  },

  onKeyPress: function(event) {
    if(this.active)
      switch(event.keyCode) {
       case Event.KEY_TAB:
       case Event.KEY_RETURN:
         this.selectEntry();
         Event.stop(event);
       case Event.KEY_ESC:
         this.hide();
         this.active = false;
         Event.stop(event);
         return;
       case Event.KEY_LEFT:
       case Event.KEY_RIGHT:
         return;
       case Event.KEY_UP:
         this.markPrevious();
         this.render();
         Event.stop(event);
         return;
       case Event.KEY_DOWN:
         this.markNext();
         this.render();
         Event.stop(event);
         return;
      }
     else
       if(event.keyCode==Event.KEY_TAB || event.keyCode==Event.KEY_RETURN ||
         (Prototype.Browser.WebKit > 0 && event.keyCode == 0)) return;

    this.changed = true;
    this.hasFocus = true;

    if(this.observer) clearTimeout(this.observer);
      this.observer =
        setTimeout(this.onObserverEvent.bind(this), this.options.frequency*1000);
  },

  activate: function() {
    this.changed = false;
    this.hasFocus = true;
    this.getUpdatedChoices();
  },

  onHover: function(event) {
    var element = Event.findElement(event, 'LI');
    if(this.index != element.autocompleteIndex)
    {
        this.index = element.autocompleteIndex;
        this.render();
    }
    Event.stop(event);
  },

  onClick: function(event) {
    var element = Event.findElement(event, 'LI');
    this.index = element.autocompleteIndex;
    this.selectEntry();
    this.hide();
  },

  onBlur: function(event) {
    // needed to make click events working
    setTimeout(this.hide.bind(this), 250);
    this.hasFocus = false;
    this.active = false;
  },

  render: function() {
    if(this.entryCount > 0) {
      for (var i = 0; i < this.entryCount; i++)
        this.index==i ?
          Element.addClassName(this.getEntry(i),"selected") :
          Element.removeClassName(this.getEntry(i),"selected");
      if(this.hasFocus) {
        this.show();
        this.active = true;
      }
    } else {
      this.active = false;
      this.hide();
    }
  },

  markPrevious: function() {
    if(this.index > 0) this.index--;
      else this.index = this.entryCount-1;
    this.getEntry(this.index).scrollIntoView(true);
  },

  markNext: function() {
    if(this.index < this.entryCount-1) this.index++;
      else this.index = 0;
    this.getEntry(this.index).scrollIntoView(false);
  },

  getEntry: function(index) {
    return this.update.firstChild.childNodes[index];
  },

  getCurrentEntry: function() {
    return this.getEntry(this.index);
  },

  selectEntry: function() {
    this.active = false;
    this.updateElement(this.getCurrentEntry());
  },

  updateElement: function(selectedElement) {
    if (this.options.updateElement) {
      this.options.updateElement(selectedElement);
      return;
    }
    var value = '';
    if (this.options.select) {
      var nodes = $(selectedElement).select('.' + this.options.select) || [];
      if(nodes.length>0) value = Element.collectTextNodes(nodes[0], this.options.select);
    } else
      value = Element.collectTextNodesIgnoreClass(selectedElement, 'informal');

    var bounds = this.getTokenBounds();
    if (bounds[0] != -1) {
      var newValue = this.element.value.substr(0, bounds[0]);
      var whitespace = this.element.value.substr(bounds[0]).match(/^\s+/);
      if (whitespace)
        newValue += whitespace[0];
      this.element.value = newValue + value + this.element.value.substr(bounds[1]);
    } else {
      this.element.value = value;
    }
    this.oldElementValue = this.element.value;
    this.element.focus();

    if (this.options.afterUpdateElement)
      this.options.afterUpdateElement(this.element, selectedElement);
  },

  updateChoices: function(choices) {
    if(!this.changed && this.hasFocus) {
      this.update.innerHTML = choices;
      Element.cleanWhitespace(this.update);
      Element.cleanWhitespace(this.update.down());

      if(this.update.firstChild && this.update.down().childNodes) {
        this.entryCount =
          this.update.down().childNodes.length;
        for (var i = 0; i < this.entryCount; i++) {
          var entry = this.getEntry(i);
          entry.autocompleteIndex = i;
          this.addObservers(entry);
        }
      } else {
        this.entryCount = 0;
      }

      this.stopIndicator();
      this.index = 0;

      if(this.entryCount==1 && this.options.autoSelect) {
        this.selectEntry();
        this.hide();
      } else {
        this.render();
      }
    }
  },

  addObservers: function(element) {
    Event.observe(element, "mouseover", this.onHover.bindAsEventListener(this));
    Event.observe(element, "click", this.onClick.bindAsEventListener(this));
  },

  onObserverEvent: function() {
    this.changed = false;
    this.tokenBounds = null;
    if(this.getToken().length>=this.options.minChars) {
      this.getUpdatedChoices();
    } else {
      this.active = false;
      this.hide();
    }
    this.oldElementValue = this.element.value;
  },

  getToken: function() {
    var bounds = this.getTokenBounds();
    return this.element.value.substring(bounds[0], bounds[1]).strip();
  },

  getTokenBounds: function() {
    if (null != this.tokenBounds) return this.tokenBounds;
    var value = this.element.value;
    if (value.strip().empty()) return [-1, 0];
    var diff = arguments.callee.getFirstDifferencePos(value, this.oldElementValue);
    var offset = (diff == this.oldElementValue.length ? 1 : 0);
    var prevTokenPos = -1, nextTokenPos = value.length;
    var tp;
    for (var index = 0, l = this.options.tokens.length; index < l; ++index) {
      tp = value.lastIndexOf(this.options.tokens[index], diff + offset - 1);
      if (tp > prevTokenPos) prevTokenPos = tp;
      tp = value.indexOf(this.options.tokens[index], diff + offset);
      if (-1 != tp && tp < nextTokenPos) nextTokenPos = tp;
    }
    return (this.tokenBounds = [prevTokenPos + 1, nextTokenPos]);
  }
});

Autocompleter.Base.prototype.getTokenBounds.getFirstDifferencePos = function(newS, oldS) {
  var boundary = Math.min(newS.length, oldS.length);
  for (var index = 0; index < boundary; ++index)
    if (newS[index] != oldS[index])
      return index;
  return boundary;
};

Ajax.Autocompleter = Class.create(Autocompleter.Base, {
  initialize: function(element, update, url, options) {
    this.baseInitialize(element, update, options);
    this.options.asynchronous  = true;
    this.options.onComplete    = this.onComplete.bind(this);
    this.options.defaultParams = this.options.parameters || null;
    this.url                   = url;
  },

  getUpdatedChoices: function() {
    this.startIndicator();

    var entry = encodeURIComponent(this.options.paramName) + '=' +
      encodeURIComponent(this.getToken());

    this.options.parameters = this.options.callback ?
      this.options.callback(this.element, entry) : entry;

    if(this.options.defaultParams)
      this.options.parameters += '&' + this.options.defaultParams;

    new Ajax.Request(this.url, this.options);
  },

  onComplete: function(request) {
    this.updateChoices(request.responseText);
  }
});

// The local array autocompleter. Used when you'd prefer to
// inject an array of autocompletion options into the page, rather
// than sending out Ajax queries, which can be quite slow sometimes.
//
// The constructor takes four parameters. The first two are, as usual,
// the id of the monitored textbox, and id of the autocompletion menu.
// The third is the array you want to autocomplete from, and the fourth
// is the options block.
//
// Extra local autocompletion options:
// - choices - How many autocompletion choices to offer
//
// - partialSearch - If false, the autocompleter will match entered
//                    text only at the beginning of strings in the
//                    autocomplete array. Defaults to true, which will
//                    match text at the beginning of any *word* in the
//                    strings in the autocomplete array. If you want to
//                    search anywhere in the string, additionally set
//                    the option fullSearch to true (default: off).
//
// - fullSsearch - Search anywhere in autocomplete array strings.
//
// - partialChars - How many characters to enter before triggering
//                   a partial match (unlike minChars, which defines
//                   how many characters are required to do any match
//                   at all). Defaults to 2.
//
// - ignoreCase - Whether to ignore case when autocompleting.
//                 Defaults to true.
//
// It's possible to pass in a custom function as the 'selector'
// option, if you prefer to write your own autocompletion logic.
// In that case, the other options above will not apply unless
// you support them.

Autocompleter.Local = Class.create(Autocompleter.Base, {
  initialize: function(element, update, array, options) {
    this.baseInitialize(element, update, options);
    this.options.array = array;
  },

  getUpdatedChoices: function() {
    this.updateChoices(this.options.selector(this));
  },

  setOptions: function(options) {
    this.options = Object.extend({
      choices: 10,
      partialSearch: true,
      partialChars: 2,
      ignoreCase: true,
      fullSearch: false,
      selector: function(instance) {
        var ret       = []; // Beginning matches
        var partial   = []; // Inside matches
        var entry     = instance.getToken();
        var count     = 0;

        for (var i = 0; i < instance.options.array.length &&
          ret.length < instance.options.choices ; i++) {

          var elem = instance.options.array[i];
          var foundPos = instance.options.ignoreCase ?
            elem.toLowerCase().indexOf(entry.toLowerCase()) :
            elem.indexOf(entry);

          while (foundPos != -1) {
            if (foundPos == 0 && elem.length != entry.length) {
              ret.push("<li><strong>" + elem.substr(0, entry.length) + "</strong>" +
                elem.substr(entry.length) + "</li>");
              break;
            } else if (entry.length >= instance.options.partialChars &&
              instance.options.partialSearch && foundPos != -1) {
              if (instance.options.fullSearch || /\s/.test(elem.substr(foundPos-1,1))) {
                partial.push("<li>" + elem.substr(0, foundPos) + "<strong>" +
                  elem.substr(foundPos, entry.length) + "</strong>" + elem.substr(
                  foundPos + entry.length) + "</li>");
                break;
              }
            }

            foundPos = instance.options.ignoreCase ?
              elem.toLowerCase().indexOf(entry.toLowerCase(), foundPos + 1) :
              elem.indexOf(entry, foundPos + 1);

          }
        }
        if (partial.length)
          ret = ret.concat(partial.slice(0, instance.options.choices - ret.length));
        return "<ul>" + ret.join('') + "</ul>";
      }
    }, options || { });
  }
});

// AJAX in-place editor and collection editor
// Full rewrite by Christophe Porteneuve <tdd@tddsworld.com> (April 2007).

// Use this if you notice weird scrolling problems on some browsers,
// the DOM might be a bit confused when this gets called so do this
// waits 1 ms (with setTimeout) until it does the activation
Field.scrollFreeActivate = function(field) {
  setTimeout(function() {
    Field.activate(field);
  }, 1);
};

Ajax.InPlaceEditor = Class.create({
  initialize: function(element, url, options) {
    this.url = url;
    this.element = element = $(element);
    this.prepareOptions();
    this._controls = { };
    arguments.callee.dealWithDeprecatedOptions(options); // DEPRECATION LAYER!!!
    Object.extend(this.options, options || { });
    if (!this.options.formId && this.element.id) {
      this.options.formId = this.element.id + '-inplaceeditor';
      if ($(this.options.formId))
        this.options.formId = '';
    }
    if (this.options.externalControl)
      this.options.externalControl = $(this.options.externalControl);
    if (!this.options.externalControl)
      this.options.externalControlOnly = false;
    this._originalBackground = this.element.getStyle('background-color') || 'transparent';
    this.element.title = this.options.clickToEditText;
    this._boundCancelHandler = this.handleFormCancellation.bind(this);
    this._boundComplete = (this.options.onComplete || Prototype.emptyFunction).bind(this);
    this._boundFailureHandler = this.handleAJAXFailure.bind(this);
    this._boundSubmitHandler = this.handleFormSubmission.bind(this);
    this._boundWrapperHandler = this.wrapUp.bind(this);
    this.registerListeners();
  },
  checkForEscapeOrReturn: function(e) {
    if (!this._editing || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (Event.KEY_ESC == e.keyCode)
      this.handleFormCancellation(e);
    else if (Event.KEY_RETURN == e.keyCode)
      this.handleFormSubmission(e);
  },
  createControl: function(mode, handler, extraClasses) {
    var control = this.options[mode + 'Control'];
    var text = this.options[mode + 'Text'];
    if ('button' == control) {
      var btn = document.createElement('input');
      btn.type = 'submit';
      btn.value = text;
      btn.className = 'editor_' + mode + '_button';
      if ('cancel' == mode)
        btn.onclick = this._boundCancelHandler;
      this._form.appendChild(btn);
      this._controls[mode] = btn;
    } else if ('link' == control) {
      var link = document.createElement('a');
      link.href = '#';
      link.appendChild(document.createTextNode(text));
      link.onclick = 'cancel' == mode ? this._boundCancelHandler : this._boundSubmitHandler;
      link.className = 'editor_' + mode + '_link';
      if (extraClasses)
        link.className += ' ' + extraClasses;
      this._form.appendChild(link);
      this._controls[mode] = link;
    }
  },
  createEditField: function() {
    var text = (this.options.loadTextURL ? this.options.loadingText : this.getText());
    var fld;
    if (1 >= this.options.rows && !/\r|\n/.test(this.getText())) {
      fld = document.createElement('input');
      fld.type = 'text';
      var size = this.options.size || this.options.cols || 0;
      if (0 < size) fld.size = size;
    } else {
      fld = document.createElement('textarea');
      fld.rows = (1 >= this.options.rows ? this.options.autoRows : this.options.rows);
      fld.cols = this.options.cols || 40;
    }
    fld.name = this.options.paramName;
    fld.value = text; // No HTML breaks conversion anymore
    fld.className = 'editor_field';
    if (this.options.submitOnBlur)
      fld.onblur = this._boundSubmitHandler;
    this._controls.editor = fld;
    if (this.options.loadTextURL)
      this.loadExternalText();
    this._form.appendChild(this._controls.editor);
  },
  createForm: function() {
    var ipe = this;
    function addText(mode, condition) {
      var text = ipe.options['text' + mode + 'Controls'];
      if (!text || condition === false) return;
      ipe._form.appendChild(document.createTextNode(text));
    };
    this._form = $(document.createElement('form'));
    this._form.id = this.options.formId;
    this._form.addClassName(this.options.formClassName);
    this._form.onsubmit = this._boundSubmitHandler;
    this.createEditField();
    if ('textarea' == this._controls.editor.tagName.toLowerCase())
      this._form.appendChild(document.createElement('br'));
    if (this.options.onFormCustomization)
      this.options.onFormCustomization(this, this._form);
    addText('Before', this.options.okControl || this.options.cancelControl);
    this.createControl('ok', this._boundSubmitHandler);
    addText('Between', this.options.okControl && this.options.cancelControl);
    this.createControl('cancel', this._boundCancelHandler, 'editor_cancel');
    addText('After', this.options.okControl || this.options.cancelControl);
  },
  destroy: function() {
    if (this._oldInnerHTML)
      this.element.innerHTML = this._oldInnerHTML;
    this.leaveEditMode();
    this.unregisterListeners();
  },
  enterEditMode: function(e) {
    if (this._saving || this._editing) return;
    this._editing = true;
    this.triggerCallback('onEnterEditMode');
    if (this.options.externalControl)
      this.options.externalControl.hide();
    this.element.hide();
    this.createForm();
    this.element.parentNode.insertBefore(this._form, this.element);
    if (!this.options.loadTextURL)
      this.postProcessEditField();
    if (e) Event.stop(e);
  },
  enterHover: function(e) {
    if (this.options.hoverClassName)
      this.element.addClassName(this.options.hoverClassName);
    if (this._saving) return;
    this.triggerCallback('onEnterHover');
  },
  getText: function() {
    return this.element.innerHTML.unescapeHTML();
  },
  handleAJAXFailure: function(transport) {
    this.triggerCallback('onFailure', transport);
    if (this._oldInnerHTML) {
      this.element.innerHTML = this._oldInnerHTML;
      this._oldInnerHTML = null;
    }
  },
  handleFormCancellation: function(e) {
    this.wrapUp();
    if (e) Event.stop(e);
  },
  handleFormSubmission: function(e) {
    var form = this._form;
    var value = $F(this._controls.editor);
    this.prepareSubmission();
    var params = this.options.callback(form, value) || '';
    if (Object.isString(params))
      params = params.toQueryParams();
    params.editorId = this.element.id;
    if (this.options.htmlResponse) {
      var options = Object.extend({ evalScripts: true }, this.options.ajaxOptions);
      Object.extend(options, {
        parameters: params,
        onComplete: this._boundWrapperHandler,
        onFailure: this._boundFailureHandler
      });
      new Ajax.Updater({ success: this.element }, this.url, options);
    } else {
      var options = Object.extend({ method: 'get' }, this.options.ajaxOptions);
      Object.extend(options, {
        parameters: params,
        onComplete: this._boundWrapperHandler,
        onFailure: this._boundFailureHandler
      });
      new Ajax.Request(this.url, options);
    }
    if (e) Event.stop(e);
  },
  leaveEditMode: function() {
    this.element.removeClassName(this.options.savingClassName);
    this.removeForm();
    this.leaveHover();
    this.element.style.backgroundColor = this._originalBackground;
    this.element.show();
    if (this.options.externalControl)
      this.options.externalControl.show();
    this._saving = false;
    this._editing = false;
    this._oldInnerHTML = null;
    this.triggerCallback('onLeaveEditMode');
  },
  leaveHover: function(e) {
    if (this.options.hoverClassName)
      this.element.removeClassName(this.options.hoverClassName);
    if (this._saving) return;
    this.triggerCallback('onLeaveHover');
  },
  loadExternalText: function() {
    this._form.addClassName(this.options.loadingClassName);
    this._controls.editor.disabled = true;
    var options = Object.extend({ method: 'get' }, this.options.ajaxOptions);
    Object.extend(options, {
      parameters: 'editorId=' + encodeURIComponent(this.element.id),
      onComplete: Prototype.emptyFunction,
      onSuccess: function(transport) {
        this._form.removeClassName(this.options.loadingClassName);
        var text = transport.responseText;
        if (this.options.stripLoadedTextTags)
          text = text.stripTags();
        this._controls.editor.value = text;
        this._controls.editor.disabled = false;
        this.postProcessEditField();
      }.bind(this),
      onFailure: this._boundFailureHandler
    });
    new Ajax.Request(this.options.loadTextURL, options);
  },
  postProcessEditField: function() {
    var fpc = this.options.fieldPostCreation;
    if (fpc)
      $(this._controls.editor)['focus' == fpc ? 'focus' : 'activate']();
  },
  prepareOptions: function() {
    this.options = Object.clone(Ajax.InPlaceEditor.DefaultOptions);
    Object.extend(this.options, Ajax.InPlaceEditor.DefaultCallbacks);
    [this._extraDefaultOptions].flatten().compact().each(function(defs) {
      Object.extend(this.options, defs);
    }.bind(this));
  },
  prepareSubmission: function() {
    this._saving = true;
    this.removeForm();
    this.leaveHover();
    this.showSaving();
  },
  registerListeners: function() {
    this._listeners = { };
    var listener;
    $H(Ajax.InPlaceEditor.Listeners).each(function(pair) {
      listener = this[pair.value].bind(this);
      this._listeners[pair.key] = listener;
      if (!this.options.externalControlOnly)
        this.element.observe(pair.key, listener);
      if (this.options.externalControl)
        this.options.externalControl.observe(pair.key, listener);
    }.bind(this));
  },
  removeForm: function() {
    if (!this._form) return;
    this._form.remove();
    this._form = null;
    this._controls = { };
  },
  showSaving: function() {
    this._oldInnerHTML = this.element.innerHTML;
    this.element.innerHTML = this.options.savingText;
    this.element.addClassName(this.options.savingClassName);
    this.element.style.backgroundColor = this._originalBackground;
    this.element.show();
  },
  triggerCallback: function(cbName, arg) {
    if ('function' == typeof this.options[cbName]) {
      this.options[cbName](this, arg);
    }
  },
  unregisterListeners: function() {
    $H(this._listeners).each(function(pair) {
      if (!this.options.externalControlOnly)
        this.element.stopObserving(pair.key, pair.value);
      if (this.options.externalControl)
        this.options.externalControl.stopObserving(pair.key, pair.value);
    }.bind(this));
  },
  wrapUp: function(transport) {
    this.leaveEditMode();
    // Can't use triggerCallback due to backward compatibility: requires
    // binding + direct element
    this._boundComplete(transport, this.element);
  }
});

Object.extend(Ajax.InPlaceEditor.prototype, {
  dispose: Ajax.InPlaceEditor.prototype.destroy
});

Ajax.InPlaceCollectionEditor = Class.create(Ajax.InPlaceEditor, {
  initialize: function($super, element, url, options) {
    this._extraDefaultOptions = Ajax.InPlaceCollectionEditor.DefaultOptions;
    $super(element, url, options);
  },

  createEditField: function() {
    var list = document.createElement('select');
    list.name = this.options.paramName;
    list.size = 1;
    this._controls.editor = list;
    this._collection = this.options.collection || [];
    if (this.options.loadCollectionURL)
      this.loadCollection();
    else
      this.checkForExternalText();
    this._form.appendChild(this._controls.editor);
  },

  loadCollection: function() {
    this._form.addClassName(this.options.loadingClassName);
    this.showLoadingText(this.options.loadingCollectionText);
    var options = Object.extend({ method: 'get' }, this.options.ajaxOptions);
    Object.extend(options, {
      parameters: 'editorId=' + encodeURIComponent(this.element.id),
      onComplete: Prototype.emptyFunction,
      onSuccess: function(transport) {
        var js = transport.responseText.strip();
        if (!/^\[.*\]$/.test(js)) // TODO: improve sanity check
          throw('Server returned an invalid collection representation.');
        this._collection = eval(js);
        this.checkForExternalText();
      }.bind(this),
      onFailure: this.onFailure
    });
    new Ajax.Request(this.options.loadCollectionURL, options);
  },

  showLoadingText: function(text) {
    this._controls.editor.disabled = true;
    var tempOption = this._controls.editor.firstChild;
    if (!tempOption) {
      tempOption = document.createElement('option');
      tempOption.value = '';
      this._controls.editor.appendChild(tempOption);
      tempOption.selected = true;
    }
    tempOption.update((text || '').stripScripts().stripTags());
  },

  checkForExternalText: function() {
    this._text = this.getText();
    if (this.options.loadTextURL)
      this.loadExternalText();
    else
      this.buildOptionList();
  },

  loadExternalText: function() {
    this.showLoadingText(this.options.loadingText);
    var options = Object.extend({ method: 'get' }, this.options.ajaxOptions);
    Object.extend(options, {
      parameters: 'editorId=' + encodeURIComponent(this.element.id),
      onComplete: Prototype.emptyFunction,
      onSuccess: function(transport) {
        this._text = transport.responseText.strip();
        this.buildOptionList();
      }.bind(this),
      onFailure: this.onFailure
    });
    new Ajax.Request(this.options.loadTextURL, options);
  },

  buildOptionList: function() {
    this._form.removeClassName(this.options.loadingClassName);
    this._collection = this._collection.map(function(entry) {
      return 2 === entry.length ? entry : [entry, entry].flatten();
    });
    var marker = ('value' in this.options) ? this.options.value : this._text;
    var textFound = this._collection.any(function(entry) {
      return entry[0] == marker;
    }.bind(this));
    this._controls.editor.update('');
    var option;
    this._collection.each(function(entry, index) {
      option = document.createElement('option');
      option.value = entry[0];
      option.selected = textFound ? entry[0] == marker : 0 == index;
      option.appendChild(document.createTextNode(entry[1]));
      this._controls.editor.appendChild(option);
    }.bind(this));
    this._controls.editor.disabled = false;
    Field.scrollFreeActivate(this._controls.editor);
  }
});

//**** DEPRECATION LAYER FOR InPlace[Collection]Editor! ****
//**** This only  exists for a while,  in order to  let ****
//**** users adapt to  the new API.  Read up on the new ****
//**** API and convert your code to it ASAP!            ****

Ajax.InPlaceEditor.prototype.initialize.dealWithDeprecatedOptions = function(options) {
  if (!options) return;
  function fallback(name, expr) {
    if (name in options || expr === undefined) return;
    options[name] = expr;
  };
  fallback('cancelControl', (options.cancelLink ? 'link' : (options.cancelButton ? 'button' :
    options.cancelLink == options.cancelButton == false ? false : undefined)));
  fallback('okControl', (options.okLink ? 'link' : (options.okButton ? 'button' :
    options.okLink == options.okButton == false ? false : undefined)));
  fallback('highlightColor', options.highlightcolor);
  fallback('highlightEndColor', options.highlightendcolor);
};

Object.extend(Ajax.InPlaceEditor, {
  DefaultOptions: {
    ajaxOptions: { },
    autoRows: 3,                                // Use when multi-line w/ rows == 1
    cancelControl: 'link',                      // 'link'|'button'|false
    cancelText: 'cancel',
    clickToEditText: 'Click to edit',
    externalControl: null,                      // id|elt
    externalControlOnly: false,
    fieldPostCreation: 'activate',              // 'activate'|'focus'|false
    formClassName: 'inplaceeditor-form',
    formId: null,                               // id|elt
    highlightColor: '#ffff99',
    highlightEndColor: '#ffffff',
    hoverClassName: '',
    htmlResponse: true,
    loadingClassName: 'inplaceeditor-loading',
    loadingText: 'Loading...',
    okControl: 'button',                        // 'link'|'button'|false
    okText: 'ok',
    paramName: 'value',
    rows: 1,                                    // If 1 and multi-line, uses autoRows
    savingClassName: 'inplaceeditor-saving',
    savingText: 'Saving...',
    size: 0,
    stripLoadedTextTags: false,
    submitOnBlur: false,
    textAfterControls: '',
    textBeforeControls: '',
    textBetweenControls: ''
  },
  DefaultCallbacks: {
    callback: function(form) {
      return Form.serialize(form);
    },
    onComplete: function(transport, element) {
      // For backward compatibility, this one is bound to the IPE, and passes
      // the element directly.  It was too often customized, so we don't break it.
      new Effect.Highlight(element, {
        startcolor: this.options.highlightColor, keepBackgroundImage: true });
    },
    onEnterEditMode: null,
    onEnterHover: function(ipe) {
      ipe.element.style.backgroundColor = ipe.options.highlightColor;
      if (ipe._effect)
        ipe._effect.cancel();
    },
    onFailure: function(transport, ipe) {
      alert('Error communication with the server: ' + transport.responseText.stripTags());
    },
    onFormCustomization: null, // Takes the IPE and its generated form, after editor, before controls.
    onLeaveEditMode: null,
    onLeaveHover: function(ipe) {
      ipe._effect = new Effect.Highlight(ipe.element, {
        startcolor: ipe.options.highlightColor, endcolor: ipe.options.highlightEndColor,
        restorecolor: ipe._originalBackground, keepBackgroundImage: true
      });
    }
  },
  Listeners: {
    click: 'enterEditMode',
    keydown: 'checkForEscapeOrReturn',
    mouseover: 'enterHover',
    mouseout: 'leaveHover'
  }
});

Ajax.InPlaceCollectionEditor.DefaultOptions = {
  loadingCollectionText: 'Loading options...'
};

// Delayed observer, like Form.Element.Observer,
// but waits for delay after last key input
// Ideal for live-search fields

Form.Element.DelayedObserver = Class.create({
  initialize: function(element, delay, callback) {
    this.delay     = delay || 0.5;
    this.element   = $(element);
    this.callback  = callback;
    this.timer     = null;
    this.lastValue = $F(this.element);
    Event.observe(this.element,'keyup',this.delayedListener.bindAsEventListener(this));
  },
  delayedListener: function(event) {
    if(this.lastValue == $F(this.element)) return;
    if(this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(this.onTimerEvent.bind(this), this.delay * 1000);
    this.lastValue = $F(this.element);
  },
  onTimerEvent: function() {
    this.timer = null;
    this.callback(this.element, $F(this.element));
  }
});
(function(){var aa=encodeURIComponent,ba=Infinity,ca=setTimeout,da=isNaN,m=Math,ea=decodeURIComponent;function ha(a,b){return a.name=b}
var n="push",ia="test",ja="slice",p="replace",ka="load",la="floor",ma="charAt",na="value",q="indexOf",oa="match",pa="port",qa="createElement",ra="path",r="name",g="getTime",u="host",v="toString",w="length",x="prototype",sa="clientWidth",y="split",ta="stopPropagation",ua="scope",z="location",va="search",A="protocol",wa="clientHeight",xa="href",B="substring",ya="apply",za="navigator",C="join",D="toLowerCase",E;function Aa(a,b){switch(b){case 0:return""+a;case 1:return 1*a;case 2:return!!a;case 3:return 1E3*a}return a}function Ba(a){return"function"==typeof a}function Ca(a){return void 0!=a&&-1<(a.constructor+"")[q]("String")}function F(a,b){return void 0==a||"-"==a&&!b||""==a}function Da(a){if(!a||""==a)return"";for(;a&&-1<" \n\r\t"[q](a[ma](0));)a=a[B](1);for(;a&&-1<" \n\r\t"[q](a[ma](a[w]-1));)a=a[B](0,a[w]-1);return a}function Ea(){return m.round(2147483647*m.random())}function Fa(){}
function G(a,b){if(aa instanceof Function)return b?encodeURI(a):aa(a);H(68);return escape(a)}function I(a){a=a[y]("+")[C](" ");if(ea instanceof Function)try{return ea(a)}catch(b){H(17)}else H(68);return unescape(a)}var Ga=function(a,b,c,d){a.addEventListener?a.addEventListener(b,c,!!d):a.attachEvent&&a.attachEvent("on"+b,c)},Ha=function(a,b,c,d){a.removeEventListener?a.removeEventListener(b,c,!!d):a.detachEvent&&a.detachEvent("on"+b,c)};
function Ia(a,b){if(a){var c=J[qa]("script");c.type="text/javascript";c.async=!0;c.src=a;c.id=b;var d=J.getElementsByTagName("script")[0];d.parentNode.insertBefore(c,d);return c}}function K(a){return a&&0<a[w]?a[0]:""}function L(a){var b=a?a[w]:0;return 0<b?a[b-1]:""}var Ja=function(){this.prefix="ga.";this.R={}};Ja[x].set=function(a,b){this.R[this.prefix+a]=b};Ja[x].get=function(a){return this.R[this.prefix+a]};Ja[x].contains=function(a){return void 0!==this.get(a)};function Ka(a){0==a[q]("www.")&&(a=a[B](4));return a[D]()}function La(a,b){var c,d={url:a,protocol:"http",host:"",path:"",d:new Ja,anchor:""};if(!a)return d;c=a[q]("://");0<=c&&(d.protocol=a[B](0,c),a=a[B](c+3));c=a[va]("/|\\?|#");if(0<=c)d.host=a[B](0,c)[D](),a=a[B](c);else return d.host=a[D](),d;c=a[q]("#");0<=c&&(d.anchor=a[B](c+1),a=a[B](0,c));c=a[q]("?");0<=c&&(Na(d.d,a[B](c+1)),a=a[B](0,c));d.anchor&&b&&Na(d.d,d.anchor);a&&"/"==a[ma](0)&&(a=a[B](1));d.path=a;return d}
function Oa(a,b){function c(a){var b=(a.hostname||"")[y](":")[0][D](),c=(a[A]||"")[D](),c=1*a[pa]||("http:"==c?80:"https:"==c?443:"");a=a.pathname||"";0==a[q]("/")||(a="/"+a);return[b,""+c,a]}var d=b||J[qa]("a");d.href=J[z][xa];var e=(d[A]||"")[D](),f=c(d),Be=d[va]||"",k=e+"//"+f[0]+(f[1]?":"+f[1]:"");0==a[q]("//")?a=e+a:0==a[q]("/")?a=k+a:a&&0!=a[q]("?")?0>a[y]("/")[0][q](":")&&(a=k+f[2][B](0,f[2].lastIndexOf("/"))+"/"+a):a=k+f[2]+(a||Be);d.href=a;e=c(d);return{protocol:(d[A]||"")[D](),host:e[0],
port:e[1],path:e[2],Oa:d[va]||"",url:a||""}}function Na(a,b){function c(b,c){a.contains(b)||a.set(b,[]);a.get(b)[n](c)}for(var d=Da(b)[y]("&"),e=0;e<d[w];e++)if(d[e]){var f=d[e][q]("=");0>f?c(d[e],"1"):c(d[e][B](0,f),d[e][B](f+1))}}function Pa(a,b){if(F(a)||"["==a[ma](0)&&"]"==a[ma](a[w]-1))return"-";var c=J.domain;return a[q](c+(b&&"/"!=b?b:""))==(0==a[q]("http://")?7:0==a[q]("https://")?8:0)?"0":a};var Qa=0;function Ra(a,b,c){1<=Qa||1<=100*m.random()||(a=["utmt=error","utmerr="+a,"utmwv=5.4.4","utmn="+Ea(),"utmsp=1"],b&&a[n]("api="+b),c&&a[n]("msg="+G(c[B](0,100))),M.w&&a[n]("aip=1"),Sa(a[C]("&")),Qa++)};var Ta=0,Ua={};function N(a){return Va("x"+Ta++,a)}function Va(a,b){Ua[a]=!!b;return a}
var Wa=N(),Xa=Va("anonymizeIp"),Ya=N(),$a=N(),ab=N(),bb=N(),O=N(),P=N(),cb=N(),db=N(),eb=N(),fb=N(),gb=N(),hb=N(),ib=N(),jb=N(),kb=N(),lb=N(),nb=N(),ob=N(),pb=N(),qb=N(),rb=N(),sb=N(),tb=N(),ub=N(),vb=N(),wb=N(),xb=N(),yb=N(),zb=N(),Ab=N(),Bb=N(),Cb=N(),Db=N(),Eb=N(),Fb=N(!0),Gb=Va("currencyCode"),Hb=Va("page"),Ib=Va("title"),Jb=N(),Kb=N(),Lb=N(),Mb=N(),Nb=N(),Ob=N(),Pb=N(),Qb=N(),Rb=N(),Q=N(!0),Sb=N(!0),Tb=N(!0),Ub=N(!0),Vb=N(!0),Wb=N(!0),Zb=N(!0),$b=N(!0),ac=N(!0),bc=N(!0),cc=N(!0),R=N(!0),dc=N(!0),
ec=N(!0),fc=N(!0),gc=N(!0),hc=N(!0),ic=N(!0),jc=N(!0),S=N(!0),kc=N(!0),lc=N(!0),mc=N(!0),nc=N(!0),oc=N(!0),pc=N(!0),qc=N(!0),rc=Va("campaignParams"),sc=N(),tc=Va("hitCallback"),uc=N();N();var vc=N(),wc=N(),xc=N(),yc=N(),zc=N(),Ac=N(),Bc=N(),Cc=N(),Dc=N(),Ec=N(),Fc=N(),Gc=N(),Hc=N(),Ic=N();N();var Mc=N(),Nc=N(),Oc=N(),Oe=Va("uaName"),Pe=Va("uaDomain"),Qe=Va("uaPath");var Re=function(){function a(a,c,d){T($[x],a,c,d)}a("_createTracker",$[x].r,55);a("_getTracker",$[x].oa,0);a("_getTrackerByName",$[x].u,51);a("_getTrackers",$[x].pa,130);a("_anonymizeIp",$[x].aa,16);a("_forceSSL",$[x].la,125);a("_getPlugin",Pc,120)},Se=function(){function a(a,c,d){T(U[x],a,c,d)}Qc("_getName",$a,58);Qc("_getAccount",Wa,64);Qc("_visitCode",Q,54);Qc("_getClientInfo",ib,53,1);Qc("_getDetectTitle",lb,56,1);Qc("_getDetectFlash",jb,65,1);Qc("_getLocalGifPath",wb,57);Qc("_getServiceMode",
xb,59);V("_setClientInfo",ib,66,2);V("_setAccount",Wa,3);V("_setNamespace",Ya,48);V("_setAllowLinker",fb,11,2);V("_setDetectFlash",jb,61,2);V("_setDetectTitle",lb,62,2);V("_setLocalGifPath",wb,46,0);V("_setLocalServerMode",xb,92,void 0,0);V("_setRemoteServerMode",xb,63,void 0,1);V("_setLocalRemoteServerMode",xb,47,void 0,2);V("_setSampleRate",vb,45,1);V("_setCampaignTrack",kb,36,2);V("_setAllowAnchor",gb,7,2);V("_setCampNameKey",ob,41);V("_setCampContentKey",tb,38);V("_setCampIdKey",nb,39);V("_setCampMediumKey",
rb,40);V("_setCampNOKey",ub,42);V("_setCampSourceKey",qb,43);V("_setCampTermKey",sb,44);V("_setCampCIdKey",pb,37);V("_setCookiePath",P,9,0);V("_setMaxCustomVariables",yb,0,1);V("_setVisitorCookieTimeout",cb,28,1);V("_setSessionCookieTimeout",db,26,1);V("_setCampaignCookieTimeout",eb,29,1);V("_setReferrerOverride",Jb,49);V("_setSiteSpeedSampleRate",Dc,132);a("_trackPageview",U[x].Fa,1);a("_trackEvent",U[x].F,4);a("_trackPageLoadTime",U[x].Ea,100);a("_trackSocial",U[x].Ga,104);a("_trackTrans",U[x].Ia,
18);a("_sendXEvent",U[x].t,78);a("_createEventTracker",U[x].ia,74);a("_getVersion",U[x].qa,60);a("_setDomainName",U[x].B,6);a("_setAllowHash",U[x].va,8);a("_getLinkerUrl",U[x].na,52);a("_link",U[x].link,101);a("_linkByPost",U[x].ua,102);a("_setTrans",U[x].za,20);a("_addTrans",U[x].$,21);a("_addItem",U[x].Y,19);a("_clearTrans",U[x].ea,105);a("_setTransactionDelim",U[x].Aa,82);a("_setCustomVar",U[x].wa,10);a("_deleteCustomVar",U[x].ka,35);a("_getVisitorCustomVar",U[x].ra,50);a("_setXKey",U[x].Ca,83);
a("_setXValue",U[x].Da,84);a("_getXKey",U[x].sa,76);a("_getXValue",U[x].ta,77);a("_clearXKey",U[x].fa,72);a("_clearXValue",U[x].ga,73);a("_createXObj",U[x].ja,75);a("_addIgnoredOrganic",U[x].W,15);a("_clearIgnoredOrganic",U[x].ba,97);a("_addIgnoredRef",U[x].X,31);a("_clearIgnoredRef",U[x].ca,32);a("_addOrganic",U[x].Z,14);a("_clearOrganic",U[x].da,70);a("_cookiePathCopy",U[x].ha,30);a("_get",U[x].ma,106);a("_set",U[x].xa,107);a("_addEventListener",U[x].addEventListener,108);a("_removeEventListener",
U[x].removeEventListener,109);a("_addDevId",U[x].V);a("_getPlugin",Pc,122);a("_setPageGroup",U[x].ya,126);a("_trackTiming",U[x].Ha,124);a("_initData",U[x].v,2);a("_setVar",U[x].Ba,22);V("_setSessionTimeout",db,27,3);V("_setCookieTimeout",eb,25,3);V("_setCookiePersistence",cb,24,1);a("_setAutoTrackOutbound",Fa,79);a("_setTrackOutboundSubdomains",Fa,81);a("_setHrefExamineLimit",Fa,80)};function Pc(a){var b=this.plugins_;if(b)return b.get(a)}
var T=function(a,b,c,d){a[b]=function(){try{return void 0!=d&&H(d),c[ya](this,arguments)}catch(a){throw Ra("exc",b,a&&a[r]),a;}}},Qc=function(a,b,c,d){U[x][a]=function(){try{return H(c),Aa(this.a.get(b),d)}catch(e){throw Ra("exc",a,e&&e[r]),e;}}},V=function(a,b,c,d,e){U[x][a]=function(f){try{H(c),void 0==e?this.a.set(b,Aa(f,d)):this.a.set(b,e)}catch(Be){throw Ra("exc",a,Be&&Be[r]),Be;}}},Te=function(a,b){return{type:b,target:a,stopPropagation:function(){throw"aborted";}}};var Rc=RegExp(/(^|\.)doubleclick\.net$/i),Sc=function(a,b){return Rc[ia](J[z].hostname)?!0:"/"!==b?!1:0!=a[q]("www.google.")&&0!=a[q](".google.")&&0!=a[q]("google.")||-1<a[q]("google.org")?!1:!0},Tc=function(a){var b=a.get(bb),c=a.c(P,"/");Sc(b,c)&&a[ta]()};var Zc=function(){var a={},b={},c=new Uc;this.g=function(a,b){c.add(a,b)};var d=new Uc;this.e=function(a,b){d.add(a,b)};var e=!1,f=!1,Be=!0;this.T=function(){e=!0};this.j=function(a){this[ka]();this.set(sc,a,!0);a=new Vc(this);e=!1;d.execute(this);e=!0;b={};this.n();a.Ja()};this.load=function(){e&&(e=!1,this.Ka(),Wc(this),f||(f=!0,c.execute(this),Xc(this),Wc(this)),e=!0)};this.n=function(){if(e)if(f)e=!1,Xc(this),e=!0;else this[ka]()};this.get=function(c){Ua[c]&&this[ka]();return void 0!==b[c]?b[c]:
a[c]};this.set=function(c,d,e){Ua[c]&&this[ka]();e?b[c]=d:a[c]=d;Ua[c]&&this.n()};this.Za=function(b){a[b]=this.b(b,0)+1};this.b=function(a,b){var c=this.get(a);return void 0==c||""===c?b:1*c};this.c=function(a,b){var c=this.get(a);return void 0==c?b:c+""};this.Ka=function(){if(Be){var b=this.c(bb,""),c=this.c(P,"/");Sc(b,c)||(a[O]=a[hb]&&""!=b?Yc(b):1,Be=!1)}}};Zc[x].stopPropagation=function(){throw"aborted";};
var Vc=function(a){var b=this;this.q=0;var c=a.get(tc);this.Ua=function(){0<b.q&&c&&(b.q--,b.q||c())};this.Ja=function(){!b.q&&c&&ca(c,10)};a.set(uc,b,!0)};function $c(a,b){b=b||[];for(var c=0;c<b[w];c++){var d=b[c];if(""+a==d||0==d[q](a+"."))return d}return"-"}
var bd=function(a,b,c){c=c?"":a.c(O,"1");b=b[y](".");if(6!==b[w]||ad(b[0],c))return!1;c=1*b[1];var d=1*b[2],e=1*b[3],f=1*b[4];b=1*b[5];if(!(0<=c&&0<d&&0<e&&0<f&&0<=b))return!1;a.set(Q,c);a.set(Vb,d);a.set(Wb,e);a.set(Zb,f);a.set($b,b);return!0},cd=function(a){var b=a.get(Q),c=a.get(Vb),d=a.get(Wb),e=a.get(Zb),f=a.b($b,1);return[a.b(O,1),void 0!=b?b:"-",c||"-",d||"-",e||"-",f][C](".")},dd=function(a){return[a.b(O,1),a.b(cc,0),a.b(R,1),a.b(dc,0)][C](".")},ed=function(a,b,c){c=c?"":a.c(O,"1");var d=
b[y](".");if(4!==d[w]||ad(d[0],c))d=null;a.set(cc,d?1*d[1]:0);a.set(R,d?1*d[2]:10);a.set(dc,d?1*d[3]:a.get(ab));return null!=d||!ad(b,c)},fd=function(a,b){var c=G(a.c(Tb,"")),d=[],e=a.get(Fb);if(!b&&e){for(var f=0;f<e[w];f++){var Be=e[f];Be&&1==Be[ua]&&d[n](f+"="+G(Be[r])+"="+G(Be[na])+"=1")}0<d[w]&&(c+="|"+d[C]("^"))}return c?a.b(O,1)+"."+c:null},gd=function(a,b,c){c=c?"":a.c(O,"1");b=b[y](".");if(2>b[w]||ad(b[0],c))return!1;b=b[ja](1)[C](".")[y]("|");0<b[w]&&a.set(Tb,I(b[0]));if(1>=b[w])return!0;
b=b[1][y](-1==b[1][q](",")?"^":",");for(c=0;c<b[w];c++){var d=b[c][y]("=");if(4==d[w]){var e={};ha(e,I(d[1]));e.value=I(d[2]);e.scope=1;a.get(Fb)[d[0]]=e}}return!0},hd=function(a,b){var c=Ue(a,b);return c?[a.b(O,1),a.b(ec,0),a.b(fc,1),a.b(gc,1),c][C]("."):""},Ue=function(a){function b(b,e){if(!F(a.get(b))){var f=a.c(b,""),f=f[y](" ")[C]("%20"),f=f[y]("+")[C]("%20");c[n](e+"="+f)}}var c=[];b(ic,"utmcid");b(nc,"utmcsr");b(S,"utmgclid");b(kc,"utmgclsrc");b(lc,"utmdclid");b(mc,"utmdsid");b(jc,"utmccn");
b(oc,"utmcmd");b(pc,"utmctr");b(qc,"utmcct");return c[C]("|")},id=function(a,b,c){c=c?"":a.c(O,"1");b=b[y](".");if(5>b[w]||ad(b[0],c))return a.set(ec,void 0),a.set(fc,void 0),a.set(gc,void 0),a.set(ic,void 0),a.set(jc,void 0),a.set(nc,void 0),a.set(oc,void 0),a.set(pc,void 0),a.set(qc,void 0),a.set(S,void 0),a.set(kc,void 0),a.set(lc,void 0),a.set(mc,void 0),!1;a.set(ec,1*b[1]);a.set(fc,1*b[2]);a.set(gc,1*b[3]);Ve(a,b[ja](4)[C]("."));return!0},Ve=function(a,b){function c(a){return(a=b[oa](a+"=(.*?)(?:\\|utm|$)"))&&
2==a[w]?a[1]:void 0}function d(b,c){c?(c=e?I(c):c[y]("%20")[C](" "),a.set(b,c)):a.set(b,void 0)}-1==b[q]("=")&&(b=I(b));var e="2"==c("utmcvr");d(ic,c("utmcid"));d(jc,c("utmccn"));d(nc,c("utmcsr"));d(oc,c("utmcmd"));d(pc,c("utmctr"));d(qc,c("utmcct"));d(S,c("utmgclid"));d(kc,c("utmgclsrc"));d(lc,c("utmdclid"));d(mc,c("utmdsid"))},ad=function(a,b){return b?a!=b:!/^\d+$/[ia](a)};var Uc=function(){this.filters=[]};Uc[x].add=function(a,b){this.filters[n]({name:a,s:b})};Uc[x].execute=function(a){try{for(var b=0;b<this.filters[w];b++)this.filters[b].s.call(W,a)}catch(c){}};function jd(a){100!=a.get(vb)&&a.get(Q)%1E4>=100*a.get(vb)&&a[ta]()}function kd(a){ld(a.get(Wa))&&a[ta]()}function md(a){"file:"==J[z][A]&&a[ta]()}function nd(a){a.get(Ib)||a.set(Ib,J.title,!0);a.get(Hb)||a.set(Hb,J[z].pathname+J[z][va],!0)};var od=new function(){var a=[];this.set=function(b){a[b]=!0};this.Xa=function(){for(var b=[],c=0;c<a[w];c++)a[c]&&(b[m[la](c/6)]=b[m[la](c/6)]^1<<c%6);for(c=0;c<b[w];c++)b[c]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[ma](b[c]||0);return b[C]("")+"~"}};function H(a){od.set(a)};var W=window,J=document,ld=function(a){var b=W._gaUserPrefs;if(b&&b.ioo&&b.ioo()||a&&!0===W["ga-disable-"+a])return!0;try{var c=W.external;if(c&&c._gaUserPrefs&&"oo"==c._gaUserPrefs)return!0}catch(d){}return!1},We=function(a,b){ca(a,b)},pd=function(a){var b=[],c=J.cookie[y](";");a=RegExp("^\\s*"+a+"=\\s*(.*?)\\s*$");for(var d=0;d<c[w];d++){var e=c[d][oa](a);e&&b[n](e[1])}return b},X=function(a,b,c,d,e,f){e=ld(e)?!1:Sc(d,c)?!1:!0;if(e){if(b&&0<=W[za].userAgent[q]("Firefox")){b=b[p](/\n|\r/g," ");e=
0;for(var Be=b[w];e<Be;++e){var k=b.charCodeAt(e)&255;if(10==k||13==k)b=b[B](0,e)+"?"+b[B](e+1)}}b&&2E3<b[w]&&(b=b[B](0,2E3),H(69));a=a+"="+b+"; path="+c+"; ";f&&(a+="expires="+(new Date((new Date)[g]()+f)).toGMTString()+"; ");d&&(a+="domain="+d+";");J.cookie=a}};var qd,rd,sd=function(){if(!qd){var a={},b=W[za],c=W.screen;a.Q=c?c.width+"x"+c.height:"-";a.P=c?c.colorDepth+"-bit":"-";a.language=(b&&(b.language||b.browserLanguage)||"-")[D]();a.javaEnabled=b&&b.javaEnabled()?1:0;a.characterSet=J.characterSet||J.charset||"-";try{var d;var e=J.documentElement,f=J.body,Be=f&&f[sa]&&f[wa],c=[];e&&(e[sa]&&e[wa])&&("CSS1Compat"===J.compatMode||!Be)?c=[e[sa],e[wa]]:Be&&(c=[f[sa],f[wa]]);d=0>=c[0]||0>=c[1]?"":c[C]("x");a.Wa=d}catch(k){H(135)}"preview"==b.loadPurpose&&
H(138);qd=a}},td=function(){sd();for(var a=qd,b=W[za],a=b.appName+b.version+a.language+b.platform+b.userAgent+a.javaEnabled+a.Q+a.P+(J.cookie?J.cookie:"")+(J.referrer?J.referrer:""),b=a[w],c=W.history[w];0<c;)a+=c--^b++;return Yc(a)},ud=function(a){sd();var b=qd;a.set(Lb,b.Q);a.set(Mb,b.P);a.set(Pb,b.language);a.set(Qb,b.characterSet);a.set(Nb,b.javaEnabled);a.set(Rb,b.Wa);if(a.get(ib)&&a.get(jb)){if(!(b=rd)){var c,d,e;d="ShockwaveFlash";if((b=(b=W[za])?b.plugins:void 0)&&0<b[w])for(c=0;c<b[w]&&!e;c++)d=
b[c],-1<d[r][q]("Shockwave Flash")&&(e=d.description[y]("Shockwave Flash ")[1]);else{d=d+"."+d;try{c=new ActiveXObject(d+".7"),e=c.GetVariable("$version")}catch(f){}if(!e)try{c=new ActiveXObject(d+".6"),e="WIN 6,0,21,0",c.AllowScriptAccess="always",e=c.GetVariable("$version")}catch(Be){}if(!e)try{c=new ActiveXObject(d),e=c.GetVariable("$version")}catch(k){}e&&(e=e[y](" ")[1][y](","),e=e[0]+"."+e[1]+" r"+e[2])}b=e?e:"-"}rd=b;a.set(Ob,rd)}else a.set(Ob,"-")};var vd=function(a){if(Ba(a))this.s=a;else{var b=a[0],c=b.lastIndexOf(":"),d=b.lastIndexOf(".");this.h=this.i=this.l="";-1==c&&-1==d?this.h=b:-1==c&&-1!=d?(this.i=b[B](0,d),this.h=b[B](d+1)):-1!=c&&-1==d?(this.l=b[B](0,c),this.h=b[B](c+1)):c>d?(this.i=b[B](0,d),this.l=b[B](d+1,c),this.h=b[B](c+1)):(this.i=b[B](0,d),this.h=b[B](d+1));this.k=a[ja](1);this.Ma=!this.l&&"_require"==this.h;this.J=!this.i&&!this.l&&"_provide"==this.h}},Y=function(){T(Y[x],"push",Y[x][n],5);T(Y[x],"_getPlugin",Pc,121);T(Y[x],
"_createAsyncTracker",Y[x].Sa,33);T(Y[x],"_getAsyncTracker",Y[x].Ta,34);this.I=new Ja;this.p=[]};E=Y[x];E.Na=function(a,b,c){var d=this.I.get(a);if(!Ba(d))return!1;b.plugins_=b.plugins_||new Ja;b.plugins_.set(a,new d(b,c||{}));return!0};E.push=function(a){var b=Z.Va[ya](this,arguments),b=Z.p.concat(b);for(Z.p=[];0<b[w]&&!Z.O(b[0])&&!(b.shift(),0<Z.p[w]););Z.p=Z.p.concat(b);return 0};E.Va=function(a){for(var b=[],c=0;c<arguments[w];c++)try{var d=new vd(arguments[c]);d.J?this.O(d):b[n](d)}catch(e){}return b};
E.O=function(a){try{if(a.s)a.s[ya](W);else if(a.J)this.I.set(a.k[0],a.k[1]);else{var b="_gat"==a.i?M:"_gaq"==a.i?Z:M.u(a.i);if(a.Ma){if(!this.Na(a.k[0],b,a.k[2])){if(!a.Pa){var c=Oa(""+a.k[1]);var d=c[A],e=J[z][A];var f;if(f="https:"==d||d==e?!0:"http:"!=d?!1:"http:"==e){var Be;t:{var k=Oa(J[z][xa]);if(!(c.Oa||0<=c.url[q]("?")||0<=c[ra][q]("://")||c[u]==k[u]&&c[pa]==k[pa]))for(var s="http:"==c[A]?80:443,t=M.S,b=0;b<t[w];b++)if(c[u]==t[b][0]&&(c[pa]||s)==(t[b][1]||s)&&0==c[ra][q](t[b][2])){Be=!0;break t}Be=
!1}f=Be&&!ld()}f&&(a.Pa=Ia(c.url))}return!0}}else a.l&&(b=b.plugins_.get(a.l)),b[a.h][ya](b,a.k)}}catch(Za){}};E.Sa=function(a,b){return M.r(a,b||"")};E.Ta=function(a){return M.u(a)};var yd=function(){function a(a,b,c,d){void 0==f[a]&&(f[a]={});void 0==f[a][b]&&(f[a][b]=[]);f[a][b][c]=d}function b(a,b,c){if(void 0!=f[a]&&void 0!=f[a][b])return f[a][b][c]}function c(a,b){if(void 0!=f[a]&&void 0!=f[a][b]){f[a][b]=void 0;var c=!0,d;for(d=0;d<Be[w];d++)if(void 0!=f[a][Be[d]]){c=!1;break}c&&(f[a]=void 0)}}function d(a){var b="",c=!1,d,e;for(d=0;d<Be[w];d++)if(e=a[Be[d]],void 0!=e){c&&(b+=Be[d]);for(var c=[],f=void 0,ga=void 0,ga=0;ga<e[w];ga++)if(void 0!=e[ga]){f="";ga!=mb&&void 0==
e[ga-1]&&(f+=ga[v]()+Za);for(var Cd=e[ga],Jc="",Yb=void 0,Kc=void 0,Lc=void 0,Yb=0;Yb<Cd[w];Yb++)Kc=Cd[ma](Yb),Lc=Ma[Kc],Jc+=void 0!=Lc?Lc:Kc;f+=Jc;c[n](f)}b+=k+c[C](t)+s;c=!1}else c=!0;return b}var e=this,f=[],Be=["k","v"],k="(",s=")",t="*",Za="!",Ma={"'":"'0"};Ma[s]="'1";Ma[t]="'2";Ma[Za]="'3";var mb=1;e.Ra=function(a){return void 0!=f[a]};e.A=function(){for(var a="",b=0;b<f[w];b++)void 0!=f[b]&&(a+=b[v]()+d(f[b]));return a};e.Qa=function(a){if(void 0==a)return e.A();for(var b=a.A(),c=0;c<f[w];c++)void 0==
f[c]||a.Ra(c)||(b+=c[v]()+d(f[c]));return b};e.f=function(b,c,d){if(!wd(d))return!1;a(b,"k",c,d);return!0};e.o=function(b,c,d){if(!xd(d))return!1;a(b,"v",c,d[v]());return!0};e.getKey=function(a,c){return b(a,"k",c)};e.N=function(a,c){return b(a,"v",c)};e.L=function(a){c(a,"k")};e.M=function(a){c(a,"v")};T(e,"_setKey",e.f,89);T(e,"_setValue",e.o,90);T(e,"_getKey",e.getKey,87);T(e,"_getValue",e.N,88);T(e,"_clearKey",e.L,85);T(e,"_clearValue",e.M,86)};function wd(a){return"string"==typeof a}
function xd(a){return!("number"==typeof a||void 0!=Number&&a instanceof Number)||m.round(a)!=a||da(a)||a==ba?!1:!0};var zd=function(a){var b=W.gaGlobal;a&&!b&&(W.gaGlobal=b={});return b},Ad=function(){var a=zd(!0).hid;null==a&&(a=Ea(),zd(!0).hid=a);return a},Dd=function(a){a.set(Kb,Ad());var b=zd();if(b&&b.dh==a.get(O)){var c=b.sid;c&&(a.get(ac)?H(112):H(132),a.set(Zb,c),a.get(Sb)&&a.set(Wb,c));b=b.vid;a.get(Sb)&&b&&(b=b[y]("."),a.set(Q,1*b[0]),a.set(Vb,1*b[1]))}};var Ed,Fd=function(a,b,c,d){var e=a.c(bb,""),f=a.c(P,"/");d=void 0!=d?d:a.b(cb,0);a=a.c(Wa,"");X(b,c,f,e,a,d)},Xc=function(a){var b=a.c(bb,"");a.b(O,1);var c=a.c(P,"/"),d=a.c(Wa,"");X("__utma",cd(a),c,b,d,a.get(cb));X("__utmb",dd(a),c,b,d,a.get(db));X("__utmc",""+a.b(O,1),c,b,d);var e=hd(a,!0);e?X("__utmz",e,c,b,d,a.get(eb)):X("__utmz","",c,b,"",-1);(e=fd(a,!1))?X("__utmv",e,c,b,d,a.get(cb)):X("__utmv","",c,b,"",-1)},Wc=function(a){var b=a.b(O,1);if(!bd(a,$c(b,pd("__utma"))))return a.set(Ub,!0),!1;
var c=!ed(a,$c(b,pd("__utmb")));a.set(bc,c);id(a,$c(b,pd("__utmz")));gd(a,$c(b,pd("__utmv")));Ed=!c;return!0},Gd=function(a){Ed||0<pd("__utmb")[w]||(X("__utmd","1",a.c(P,"/"),a.c(bb,""),a.c(Wa,""),1E4),0==pd("__utmd")[w]&&a[ta]())};var h=0,Jd=function(a){void 0==a.get(Q)?Hd(a):a.get(Ub)&&!a.get(Mc)?Hd(a):a.get(bc)&&(Id(a),h++,1<h&&H(137))},Kd=function(a){a.get(hc)&&!a.get(ac)&&(Id(a),a.set(fc,a.get($b)))},Hd=function(a){var b=a.get(ab);a.set(Sb,!0);a.set(Q,Ea()^td(a)&2147483647);a.set(Tb,"");a.set(Vb,b);a.set(Wb,b);a.set(Zb,b);a.set($b,1);a.set(ac,!0);a.set(cc,0);a.set(R,10);a.set(dc,b);a.set(Fb,[]);a.set(Ub,!1);a.set(bc,!1)},Id=function(a){a.set(Wb,a.get(Zb));a.set(Zb,a.get(ab));a.Za($b);a.set(ac,!0);a.set(cc,0);a.set(R,10);
a.set(dc,a.get(ab));a.set(bc,!1)};var Ld="daum:q eniro:search_word naver:query pchome:q images.google:q google:q yahoo:p yahoo:q msn:q bing:q aol:query aol:q lycos:q lycos:query ask:q netscape:query cnn:query about:terms mamma:q voila:rdata virgilio:qs live:q baidu:wd alice:qs yandex:text najdi:q seznam:q rakuten:qt biglobe:q goo.ne:MT wp:szukaj onet:qt yam:k kvasir:q ozu:q terra:query rambler:query conduit:q babylon:q search-results:q avg:q comcast:q incredimail:q startsiden:q go.mail.ru:q search.centrum.cz:q 360.cn:q".split(" "),
Sd=function(a){if(a.get(kb)&&!a.get(Mc)){for(var b=!F(a.get(ic))||!F(a.get(nc))||!F(a.get(S))||!F(a.get(lc)),c={},d=0;d<Md[w];d++){var e=Md[d];c[e]=a.get(e)}(d=a.get(rc))?(H(149),e=new Ja,Na(e,d),d=e):d=La(J[z][xa],a.get(gb)).d;if("1"!=L(d.get(a.get(ub)))||!b)if(d=Xe(a,d)||Qd(a),d||(b||!a.get(ac))||(Pd(a,void 0,"(direct)",void 0,void 0,void 0,"(direct)","(none)",void 0,void 0),d=!0),d&&(a.set(hc,Rd(a,c)),b="(direct)"==a.get(nc)&&"(direct)"==a.get(jc)&&"(none)"==a.get(oc),a.get(hc)||a.get(ac)&&!b))a.set(ec,
a.get(ab)),a.set(fc,a.get($b)),a.Za(gc)}},Xe=function(a,b){function c(c,d){d=d||"-";var e=L(b.get(a.get(c)));return e&&"-"!=e?I(e):d}var d=L(b.get(a.get(nb)))||"-",e=L(b.get(a.get(qb)))||"-",f=L(b.get(a.get(pb)))||"-",Be=L(b.get("gclsrc"))||"-",k=L(b.get("dclid"))||"-",s=c(ob,"(not set)"),t=c(rb,"(not set)"),Za=c(sb),Ma=c(tb);if(F(d)&&F(f)&&F(k)&&F(e))return!1;var mb=!F(f)&&!F(Be),mb=F(e)&&(!F(k)||mb),Xb=F(Za);if(mb||Xb){var Bd=Nd(a),Bd=La(Bd,!0);(Bd=Od(a,Bd))&&!F(Bd[1]&&!Bd[2])&&(mb&&(e=Bd[0]),Xb&&
(Za=Bd[1]))}Pd(a,d,e,f,Be,k,s,t,Za,Ma);return!0},Qd=function(a){var b=Nd(a),c=La(b,!0);if(!(void 0!=b&&null!=b&&""!=b&&"0"!=b&&"-"!=b&&0<=b[q]("://"))||c&&-1<c[u][q]("google")&&c.d.contains("q")&&"cse"==c[ra])return!1;if((b=Od(a,c))&&!b[2])return Pd(a,void 0,b[0],void 0,void 0,void 0,"(organic)","organic",b[1],void 0),!0;if(b||!a.get(ac))return!1;t:{for(var b=a.get(Bb),d=Ka(c[u]),e=0;e<b[w];++e)if(-1<d[q](b[e])){a=!1;break t}Pd(a,void 0,d,void 0,void 0,void 0,"(referral)","referral",void 0,"/"+c[ra]);
a=!0}return a},Od=function(a,b){for(var c=a.get(zb),d=0;d<c[w];++d){var e=c[d][y](":");if(-1<b[u][q](e[0][D]())){var f=b.d.get(e[1]);if(f&&(f=K(f),!f&&-1<b[u][q]("google.")&&(f="(not provided)"),!e[3]||-1<b.url[q](e[3]))){t:{for(var c=f,d=a.get(Ab),c=I(c)[D](),Be=0;Be<d[w];++Be)if(c==d[Be]){c=!0;break t}c=!1}return[e[2]||e[0],f,c]}}}return null},Pd=function(a,b,c,d,e,f,Be,k,s,t){a.set(ic,b);a.set(nc,c);a.set(S,d);a.set(kc,e);a.set(lc,f);a.set(jc,Be);a.set(oc,k);a.set(pc,s);a.set(qc,t)},Md=[jc,ic,
S,lc,nc,oc,pc,qc],Rd=function(a,b){function c(a){a=(""+a)[y]("+")[C]("%20");return a=a[y](" ")[C]("%20")}function d(c){var d=""+(a.get(c)||"");c=""+(b[c]||"");return 0<d[w]&&d==c}if(d(S)||d(lc))return H(131),!1;for(var e=0;e<Md[w];e++){var f=Md[e],Be=b[f]||"-",f=a.get(f)||"-";if(c(Be)!=c(f))return!0}return!1},Td=RegExp(/^https:\/\/(www\.)?google(\.com?)?(\.[a-z]{2}t?)?\/?$/i),Nd=function(a){a=Pa(a.get(Jb),a.get(P));try{if(Td[ia](a))return H(136),a+"?q="}catch(b){H(145)}return a};var Ud,Vd,Wd=function(a){Ud=a.c(S,"");Vd=a.c(kc,"")},Xd=function(a){var b=a.c(S,""),c=a.c(kc,"");b!=Ud&&(-1<c[q]("ds")?a.set(mc,void 0):!F(Ud)&&-1<Vd[q]("ds")&&a.set(mc,Ud))};var Zd=function(a){Yd(a,J[z][xa])?(a.set(Mc,!0),H(12)):a.set(Mc,!1)},Yd=function(a,b){if(!a.get(fb))return!1;var c=La(b,a.get(gb)),d=K(c.d.get("__utma")),e=K(c.d.get("__utmb")),f=K(c.d.get("__utmc")),Be=K(c.d.get("__utmx")),k=K(c.d.get("__utmz")),s=K(c.d.get("__utmv")),c=K(c.d.get("__utmk"));if(Yc(""+d+e+f+Be+k+s)!=c){d=I(d);e=I(e);f=I(f);Be=I(Be);f=$d(d+e+f+Be,k,s,c);if(!f)return!1;k=f[0];s=f[1]}if(!bd(a,d,!0))return!1;ed(a,e,!0);id(a,k,!0);gd(a,s,!0);ae(a,Be,!0);return!0},ce=function(a,b,c){var d;
d=cd(a)||"-";var e=dd(a)||"-",f=""+a.b(O,1)||"-",Be=be(a)||"-",k=hd(a,!1)||"-";a=fd(a,!1)||"-";var s=Yc(""+d+e+f+Be+k+a),t=[];t[n]("__utma="+d);t[n]("__utmb="+e);t[n]("__utmc="+f);t[n]("__utmx="+Be);t[n]("__utmz="+k);t[n]("__utmv="+a);t[n]("__utmk="+s);d=t[C]("&");if(!d)return b;e=b[q]("#");if(c)return 0>e?b+"#"+d:b+"&"+d;c="";f=b[q]("?");0<e&&(c=b[B](e),b=b[B](0,e));return 0>f?b+"?"+d+c:b+"&"+d+c},$d=function(a,b,c,d){for(var e=0;3>e;e++){for(var f=0;3>f;f++){if(d==Yc(a+b+c))return H(127),[b,c];
var Be=b[p](/ /g,"%20"),k=c[p](/ /g,"%20");if(d==Yc(a+Be+k))return H(128),[Be,k];Be=Be[p](/\+/g,"%20");k=k[p](/\+/g,"%20");if(d==Yc(a+Be+k))return H(129),[Be,k];try{var s=b[oa]("utmctr=(.*?)(?:\\|utm|$)");if(s&&2==s[w]&&(Be=b[p](s[1],G(I(s[1]))),d==Yc(a+Be+c)))return H(139),[Be,c]}catch(t){}b=I(b)}c=I(c)}};var de="|",fe=function(a,b,c,d,e,f,Be,k,s){var t=ee(a,b);t||(t={},a.get(Cb)[n](t));t.id_=b;t.affiliation_=c;t.total_=d;t.tax_=e;t.shipping_=f;t.city_=Be;t.state_=k;t.country_=s;t.items_=t.items_||[];return t},ge=function(a,b,c,d,e,f,Be){a=ee(a,b)||fe(a,b,"",0,0,0,"","","");var k;t:{if(a&&a.items_){k=a.items_;for(var s=0;s<k[w];s++)if(k[s].sku_==c){k=k[s];break t}}k=null}s=k||{};s.transId_=b;s.sku_=c;s.name_=d;s.category_=e;s.price_=f;s.quantity_=Be;k||a.items_[n](s);return s},ee=function(a,b){for(var c=
a.get(Cb),d=0;d<c[w];d++)if(c[d].id_==b)return c[d];return null};var he,ie=function(a){if(!he){var b;b=J[z].hash;var c=W[r],d=/^#?gaso=([^&]*)/;if(c=(b=(b=b&&b[oa](d)||c&&c[oa](d))?b[1]:K(pd("GASO")))&&b[oa](/^(?:!([-0-9a-z.]{1,40})!)?([-.\w]{10,1200})$/i))Fd(a,"GASO",""+b,0),M._gasoDomain=a.get(bb),M._gasoCPath=a.get(P),a=c[1],Ia("https://www.google.com/analytics/web/inpage/pub/inpage.js?"+(a?"prefix="+a+"&":"")+Ea(),"_gasojs");he=!0}};var ae=function(a,b,c){c&&(b=I(b));c=a.b(O,1);b=b[y](".");2>b[w]||!/^\d+$/[ia](b[0])||(b[0]=""+c,Fd(a,"__utmx",b[C]("."),void 0))},be=function(a,b){var c=$c(a.get(O),pd("__utmx"));"-"==c&&(c="");return b?G(c):c},Ye=function(a){try{var b=La(J[z][xa],!1),c=ea(L(b.d.get("utm_referrer")))||"";c&&a.set(Jb,c);var d=ea(K(b.d.get("utm_expid")))||"";d&&(d=d[y](".")[0],a.set(Oc,""+d))}catch(e){H(146)}},l=function(a){var b=W.gaData&&W.gaData.expId;b&&a.set(Oc,""+b)};var ke=function(a,b){var c=m.min(a.b(Dc,0),100);if(a.b(Q,0)%100>=c)return!1;c=Ze()||$e();if(void 0==c)return!1;var d=c[0];if(void 0==d||d==ba||da(d))return!1;0<d?af(c)?b(je(c)):b(je(c[ja](0,1))):Ga(W,"load",function(){ke(a,b)},!1);return!0},me=function(a,b,c,d){var e=new yd;e.f(14,90,b[B](0,500));e.f(14,91,a[B](0,150));e.f(14,92,""+le(c));void 0!=d&&e.f(14,93,d[B](0,500));e.o(14,90,c);return e},af=function(a){for(var b=1;b<a[w];b++)if(da(a[b])||a[b]==ba||0>a[b])return!1;return!0},le=function(a){return da(a)||
0>a?0:5E3>a?10*m[la](a/10):5E4>a?100*m[la](a/100):41E5>a?1E3*m[la](a/1E3):41E5},je=function(a){for(var b=new yd,c=0;c<a[w];c++)b.f(14,c+1,""+le(a[c])),b.o(14,c+1,a[c]);return b},Ze=function(){var a=W.performance||W.webkitPerformance;if(a=a&&a.timing){var b=a.navigationStart;if(0==b)H(133);else return[a.loadEventStart-b,a.domainLookupEnd-a.domainLookupStart,a.connectEnd-a.connectStart,a.responseStart-a.requestStart,a.responseEnd-a.responseStart,a.fetchStart-b,a.domInteractive-b,a.domContentLoadedEventStart-
b]}},$e=function(){if(W.top==W){var a=W.external,b=a&&a.onloadT;a&&!a.isValidLoadTime&&(b=void 0);2147483648<b&&(b=void 0);0<b&&a.setPageReadyTime();return void 0==b?void 0:[b]}};var cf=function(a){if(a.get(Sb))try{var b;t:{var c=pd(a.get(Oe)||"_ga");if(c&&!(1>c[w])){for(var d=[],e=0;e<c[w];e++){var f;var Be=c[e][y]("."),k=Be.shift();if(("GA1"==k||"1"==k)&&1<Be[w]){var s=Be.shift()[y]("-");1==s[w]&&(s[1]="1");s[0]*=1;s[1]*=1;f={Ya:s,$a:Be[C](".")}}else f=void 0;f&&d[n](f)}if(1==d[w]){b=d[0].$a;break t}if(0!=d[w]){var t=a.get(Pe)||a.get(bb),d=bf(d,(0==t[q](".")?t.substr(1):t)[y](".")[w],0);if(1==d[w]){b=d[0].$a;break t}var Za=a.get(Qe)||a.get(P);(c=Za)?(1<c[w]&&"/"==c[ma](c[w]-
1)&&(c=c.substr(0,c[w]-1)),0!=c[q]("/")&&(c="/"+c),Za=c):Za="/";d=bf(d,"/"==Za?1:Za[y]("/")[w],1);b=d[0].$a;break t}}b=void 0}if(b){var Ma=(""+b)[y](".");2==Ma[w]&&/[0-9.]/[ia](Ma)&&(H(114),a.set(Q,Ma[0]),a.set(Vb,Ma[1]),a.set(Sb,!1))}}catch(mb){H(115)}},bf=function(a,b,c){for(var d=[],e=[],f=128,Be=0;Be<a[w];Be++){var k=a[Be];if(k.Ya[c]==b)d[n](k);else if(k.Ya[c]==f)e[n](k);else k.Ya[c]<f&&(e=[k],f=k.Ya[c])}return 0<d[w]?d:e};var U=function(a,b,c){function d(a){return function(b){if((b=b.get(Nc)[a])&&b[w])for(var c=Te(e,a),d=0;d<b[w];d++)b[d].call(e,c)}}var e=this;this.a=new Zc;this.get=function(a){return this.a.get(a)};this.set=function(a,b,c){this.a.set(a,b,c)};this.set(Wa,b||"UA-XXXXX-X");this.set($a,a||"");this.set(Ya,c||"");this.set(ab,m.round((new Date)[g]()/1E3));this.set(P,"/");this.set(cb,63072E6);this.set(eb,15768E6);this.set(db,18E5);this.set(fb,!1);this.set(yb,50);this.set(gb,!1);this.set(hb,!0);this.set(ib,
!0);this.set(jb,!0);this.set(kb,!0);this.set(lb,!0);this.set(ob,"utm_campaign");this.set(nb,"utm_id");this.set(pb,"gclid");this.set(qb,"utm_source");this.set(rb,"utm_medium");this.set(sb,"utm_term");this.set(tb,"utm_content");this.set(ub,"utm_nooverride");this.set(vb,100);this.set(Dc,1);this.set(Ec,!1);this.set(wb,"/__utm.gif");this.set(xb,1);this.set(Cb,[]);this.set(Fb,[]);this.set(zb,Ld[ja](0));this.set(Ab,[]);this.set(Bb,[]);this.B("auto");this.set(Jb,J.referrer);Ye(this.a);this.set(Nc,{hit:[],
load:[]});this.a.g("0",Zd);this.a.g("1",Wd);this.a.g("2",Jd);this.a.g("3",cf);this.a.g("4",Sd);this.a.g("5",Xd);this.a.g("6",Kd);this.a.g("7",d("load"));this.a.g("8",ie);this.a.e("A",kd);this.a.e("B",md);this.a.e("C",Jd);this.a.e("D",jd);this.a.e("E",Tc);this.a.e("F",ne);this.a.e("G",Gd);this.a.e("H",nd);this.a.e("I",ud);this.a.e("J",Dd);this.a.e("K",l);this.a.e("L",d("hit"));this.a.e("M",oe);this.a.e("N",pe);0===this.get(ab)&&H(111);this.a.T();this.H=void 0};E=U[x];
E.m=function(){var a=this.get(Db);a||(a=new yd,this.set(Db,a));return a};E.La=function(a){for(var b in a){var c=a[b];a.hasOwnProperty(b)&&this.set(b,c,!0)}};E.K=function(a){if(this.get(Ec))return!1;var b=this,c=ke(this.a,function(c){b.set(Hb,a,!0);b.t(c)});this.set(Ec,c);return c};E.Fa=function(a){a&&Ca(a)?(H(13),this.set(Hb,a,!0)):"object"===typeof a&&null!==a&&this.La(a);this.H=a=this.get(Hb);this.a.j("page");this.K(a)};
E.F=function(a,b,c,d,e){if(""==a||(!wd(a)||""==b||!wd(b))||void 0!=c&&!wd(c)||void 0!=d&&!xd(d))return!1;this.set(wc,a,!0);this.set(xc,b,!0);this.set(yc,c,!0);this.set(zc,d,!0);this.set(vc,!!e,!0);this.a.j("event");return!0};E.Ha=function(a,b,c,d,e){var f=this.a.b(Dc,0);1*e===e&&(f=e);if(this.a.b(Q,0)%100>=f)return!1;c=1*(""+c);if(""==a||(!wd(a)||""==b||!wd(b)||!xd(c)||da(c)||0>c||0>f||100<f)||void 0!=d&&(""==d||!wd(d)))return!1;this.t(me(a,b,c,d));return!0};
E.Ga=function(a,b,c,d){if(!a||!b)return!1;this.set(Ac,a,!0);this.set(Bc,b,!0);this.set(Cc,c||J[z][xa],!0);d&&this.set(Hb,d,!0);this.a.j("social");return!0};E.Ea=function(){this.set(Dc,10);this.K(this.H)};E.Ia=function(){this.a.j("trans")};E.t=function(a){this.set(Eb,a,!0);this.a.j("event")};E.ia=function(a){this.v();var b=this;return{_trackEvent:function(c,d,e){H(91);b.F(a,c,d,e)}}};E.ma=function(a){return this.get(a)};
E.xa=function(a,b){if(a)if(Ca(a))this.set(a,b);else if("object"==typeof a)for(var c in a)a.hasOwnProperty(c)&&this.set(c,a[c])};E.addEventListener=function(a,b){var c=this.get(Nc)[a];c&&c[n](b)};E.removeEventListener=function(a,b){for(var c=this.get(Nc)[a],d=0;c&&d<c[w];d++)if(c[d]==b){c.splice(d,1);break}};E.qa=function(){return"5.4.4"};E.B=function(a){this.get(hb);a="auto"==a?Ka(J.domain):a&&"-"!=a&&"none"!=a?a[D]():"";this.set(bb,a)};E.va=function(a){this.set(hb,!!a)};
E.na=function(a,b){return ce(this.a,a,b)};E.link=function(a,b){if(this.a.get(fb)&&a){var c=ce(this.a,a,b);J[z].href=c}};E.ua=function(a,b){this.a.get(fb)&&(a&&a.action)&&(a.action=ce(this.a,a.action,b))};
E.za=function(){this.v();var a=this.a,b=J.getElementById?J.getElementById("utmtrans"):J.utmform&&J.utmform.utmtrans?J.utmform.utmtrans:null;if(b&&b[na]){a.set(Cb,[]);for(var b=b[na][y]("UTM:"),c=0;c<b[w];c++){b[c]=Da(b[c]);for(var d=b[c][y](de),e=0;e<d[w];e++)d[e]=Da(d[e]);"T"==d[0]?fe(a,d[1],d[2],d[3],d[4],d[5],d[6],d[7],d[8]):"I"==d[0]&&ge(a,d[1],d[2],d[3],d[4],d[5],d[6])}}};E.$=function(a,b,c,d,e,f,Be,k){return fe(this.a,a,b,c,d,e,f,Be,k)};E.Y=function(a,b,c,d,e,f){return ge(this.a,a,b,c,d,e,f)};
E.Aa=function(a){de=a||"|"};E.ea=function(){this.set(Cb,[])};E.wa=function(a,b,c,d){var e=this.a;if(0>=a||a>e.get(yb))a=!1;else if(!b||!c||128<b[w]+c[w])a=!1;else{1!=d&&2!=d&&(d=3);var f={};ha(f,b);f.value=c;f.scope=d;e.get(Fb)[a]=f;a=!0}a&&this.a.n();return a};E.ka=function(a){this.a.get(Fb)[a]=void 0;this.a.n()};E.ra=function(a){return(a=this.a.get(Fb)[a])&&1==a[ua]?a[na]:void 0};E.Ca=function(a,b,c){this.m().f(a,b,c)};E.Da=function(a,b,c){this.m().o(a,b,c)};
E.sa=function(a,b){return this.m().getKey(a,b)};E.ta=function(a,b){return this.m().N(a,b)};E.fa=function(a){this.m().L(a)};E.ga=function(a){this.m().M(a)};E.ja=function(){return new yd};E.W=function(a){a&&this.get(Ab)[n](a[D]())};E.ba=function(){this.set(Ab,[])};E.X=function(a){a&&this.get(Bb)[n](a[D]())};E.ca=function(){this.set(Bb,[])};E.Z=function(a,b,c,d,e){if(a&&b){a=[a,b[D]()][C](":");if(d||e)a=[a,d,e][C](":");d=this.get(zb);d.splice(c?0:d[w],0,a)}};E.da=function(){this.set(zb,[])};
E.ha=function(a){this.a[ka]();var b=this.get(P),c=be(this.a);this.set(P,a);this.a.n();ae(this.a,c);this.set(P,b)};E.ya=function(a,b){if(0<a&&5>=a&&Ca(b)&&""!=b){var c=this.get(Fc)||[];c[a]=b;this.set(Fc,c)}};E.V=function(a){a=""+a;if(a[oa](/^[A-Za-z0-9]{1,5}$/)){var b=this.get(Ic)||[];b[n](a);this.set(Ic,b)}};E.v=function(){this.a[ka]()};E.Ba=function(a){a&&""!=a&&(this.set(Tb,a),this.a.j("var"))};var ne=function(a){"trans"!==a.get(sc)&&500<=a.b(cc,0)&&a[ta]();if("event"===a.get(sc)){var b=(new Date)[g](),c=a.b(dc,0),d=a.b(Zb,0),c=m[la](1*((b-(c!=d?c:1E3*c))/1E3));0<c&&(a.set(dc,b),a.set(R,m.min(10,a.b(R,0)+c)));0>=a.b(R,0)&&a[ta]()}},pe=function(a){"event"===a.get(sc)&&a.set(R,m.max(0,a.b(R,10)-1))};var qe=function(){var a=[];this.add=function(b,c,d){d&&(c=G(""+c));a[n](b+"="+c)};this.toString=function(){return a[C]("&")}},re=function(a,b){(b||2!=a.get(xb))&&a.Za(cc)},se=function(a,b){b.add("utmwv","5.4.4");b.add("utms",a.get(cc));b.add("utmn",Ea());var c=J[z].hostname;F(c)||b.add("utmhn",c,!0);c=a.get(vb);100!=c&&b.add("utmsp",c,!0)},te=function(a,b){b.add("utmht",(new Date)[g]());b.add("utmac",Da(a.get(Wa)));a.get(Oc)&&b.add("utmxkey",a.get(Oc),!0);a.get(vc)&&b.add("utmni",1);var c=a.get(Ic);
c&&0<c[w]&&b.add("utmdid",c[C]("."));ff(a,b);!1!==a.get(Xa)&&(a.get(Xa)||M.w)&&b.add("aip",1);1<M.ab()&&b.add("utmmt",1);b.add("utmu",od.Xa())},ue=function(a,b){for(var c=a.get(Fc)||[],d=[],e=1;e<c[w];e++)c[e]&&d[n](e+":"+G(c[e][p](/%/g,"%25")[p](/:/g,"%3A")[p](/,/g,"%2C")));d[w]&&b.add("utmpg",d[C](","))},ff=function(a,b){function c(a,b){b&&d[n](a+"="+b+";")}var d=[];c("__utma",cd(a));c("__utmz",hd(a,!1));c("__utmv",fd(a,!0));c("__utmx",be(a));b.add("utmcc",d[C]("+"),!0)},ve=function(a,b){a.get(ib)&&
(b.add("utmcs",a.get(Qb),!0),b.add("utmsr",a.get(Lb)),a.get(Rb)&&b.add("utmvp",a.get(Rb)),b.add("utmsc",a.get(Mb)),b.add("utmul",a.get(Pb)),b.add("utmje",a.get(Nb)),b.add("utmfl",a.get(Ob),!0))},we=function(a,b){a.get(lb)&&a.get(Ib)&&b.add("utmdt",a.get(Ib),!0);b.add("utmhid",a.get(Kb));b.add("utmr",Pa(a.get(Jb),a.get(P)),!0);b.add("utmp",G(a.get(Hb),!0),!0)},xe=function(a,b){for(var c=a.get(Db),d=a.get(Eb),e=a.get(Fb)||[],f=0;f<e[w];f++){var Be=e[f];Be&&(c||(c=new yd),c.f(8,f,Be[r]),c.f(9,f,Be[na]),
3!=Be[ua]&&c.f(11,f,""+Be[ua]))}F(a.get(wc))||F(a.get(xc),!0)||(c||(c=new yd),c.f(5,1,a.get(wc)),c.f(5,2,a.get(xc)),e=a.get(yc),void 0!=e&&c.f(5,3,e),e=a.get(zc),void 0!=e&&c.o(5,1,e));c?b.add("utme",c.Qa(d),!0):d&&b.add("utme",d.A(),!0)},ye=function(a,b,c){var d=new qe;re(a,c);se(a,d);d.add("utmt","tran");d.add("utmtid",b.id_,!0);d.add("utmtst",b.affiliation_,!0);d.add("utmtto",b.total_,!0);d.add("utmttx",b.tax_,!0);d.add("utmtsp",b.shipping_,!0);d.add("utmtci",b.city_,!0);d.add("utmtrg",b.state_,
!0);d.add("utmtco",b.country_,!0);xe(a,d);ve(a,d);we(a,d);(b=a.get(Gb))&&d.add("utmcu",b,!0);c||(ue(a,d),te(a,d));return d[v]()},ze=function(a,b,c){var d=new qe;re(a,c);se(a,d);d.add("utmt","item");d.add("utmtid",b.transId_,!0);d.add("utmipc",b.sku_,!0);d.add("utmipn",b.name_,!0);d.add("utmiva",b.category_,!0);d.add("utmipr",b.price_,!0);d.add("utmiqt",b.quantity_,!0);xe(a,d);ve(a,d);we(a,d);(b=a.get(Gb))&&d.add("utmcu",b,!0);c||(ue(a,d),te(a,d));return d[v]()},Ae=function(a,b){var c=a.get(sc);if("page"==
c)c=new qe,re(a,b),se(a,c),xe(a,c),ve(a,c),we(a,c),b||(ue(a,c),te(a,c)),c=[c[v]()];else if("event"==c)c=new qe,re(a,b),se(a,c),c.add("utmt","event"),xe(a,c),ve(a,c),we(a,c),b||(ue(a,c),te(a,c)),c=[c[v]()];else if("var"==c)c=new qe,re(a,b),se(a,c),c.add("utmt","var"),!b&&te(a,c),c=[c[v]()];else if("trans"==c)for(var c=[],d=a.get(Cb),e=0;e<d[w];++e){c[n](ye(a,d[e],b));for(var f=d[e].items_,Be=0;Be<f[w];++Be)c[n](ze(a,f[Be],b))}else"social"==c?b?c=[]:(c=new qe,re(a,b),se(a,c),c.add("utmt","social"),
c.add("utmsn",a.get(Ac),!0),c.add("utmsa",a.get(Bc),!0),c.add("utmsid",a.get(Cc),!0),xe(a,c),ve(a,c),we(a,c),ue(a,c),te(a,c),c=[c[v]()]):"feedback"==c?b?c=[]:(c=new qe,re(a,b),se(a,c),c.add("utmt","feedback"),c.add("utmfbid",a.get(Gc),!0),c.add("utmfbpr",a.get(Hc),!0),xe(a,c),ve(a,c),we(a,c),ue(a,c),te(a,c),c=[c[v]()]):c=[];return c},oe=function(a){var b,c=a.get(xb),d=a.get(uc),e=d&&d.Ua,f=0;if(0==c||2==c){var Be=a.get(wb)+"?";b=Ae(a,!0);for(var k=0,s=b[w];k<s;k++)Sa(b[k],e,Be,!0),f++}if(1==c||2==
c)for(b=Ae(a),k=0,s=b[w];k<s;k++)try{Sa(b[k],e),f++}catch(t){t&&Ra(t[r],void 0,t.message)}d&&(d.q=f)};var Ce=function(a){ha(this,"len");this.message=a+"-8192"},De=function(a){ha(this,"ff2post");this.message=a+"-2036"},Sa=function(a,b,c,d){b=b||Fa;if(d||2036>=a[w])gf(a,b,c);else if(8192>=a[w]){if(0<=W[za].userAgent[q]("Firefox")&&![].reduce)throw new De(a[w]);hf(a,b)||Ee(a,b)}else throw new Ce(a[w]);},gf=function(a,b,c){c=c||("https:"==J[z][A]||M.G?"https://ssl.google-analytics.com":"http://www.google-analytics.com")+"/__utm.gif?";var d=new Image(1,1);d.src=c+a;d.onload=function(){d.onload=null;d.onerror=
null;b()};d.onerror=function(){d.onload=null;d.onerror=null;b()}},hf=function(a,b){var c,d=("https:"==J[z][A]||M.G?"https://ssl.google-analytics.com":"http://www.google-analytics.com")+"/p/__utm.gif",e=W.XDomainRequest;if(e)c=new e,c.open("POST",d);else if(e=W.XMLHttpRequest)e=new e,"withCredentials"in e&&(c=e,c.open("POST",d,!0),c.setRequestHeader("Content-Type","text/plain"));if(c)return c.onreadystatechange=function(){4==c.readyState&&(b(),c=null)},c.send(a),!0},Ee=function(a,b){if(J.body){a=aa(a);
try{var c=J[qa]('<iframe name="'+a+'"></iframe>')}catch(d){c=J[qa]("iframe"),ha(c,a)}c.height="0";c.width="0";c.style.display="none";c.style.visibility="hidden";var e=J[z],e=("https:"==J[z][A]||M.G?"https://ssl.google-analytics.com":"http://www.google-analytics.com")+"/u/post_iframe.html#"+aa(e[A]+"//"+e[u]+"/favicon.ico"),f=function(){c.src="";c.parentNode&&c.parentNode.removeChild(c)};Ga(W,"beforeunload",f);var Be=!1,k=0,s=function(){if(!Be){try{if(9<k||c.contentWindow[z][u]==J[z][u]){Be=!0;f();
Ha(W,"beforeunload",f);b();return}}catch(a){}k++;ca(s,200)}};Ga(c,"load",s);J.body.appendChild(c);c.src=e}else We(function(){Ee(a,b)},100)};var $=function(){this.G=this.w=!1;this.C={};this.D=[];this.U=0;this.S=[["www.google-analytics.com","","/plugins/"]];this._gasoCPath=this._gasoDomain=void 0;Re();Se()};E=$[x];E.oa=function(a,b){return this.r(a,void 0,b)};E.r=function(a,b,c){b&&H(23);c&&H(67);void 0==b&&(b="~"+M.U++);a=new U(b,a,c);M.C[b]=a;M.D[n](a);return a};E.u=function(a){a=a||"";return M.C[a]||M.r(void 0,a)};E.pa=function(){return M.D[ja](0)};E.ab=function(){return M.D[w]};E.aa=function(){this.w=!0};E.la=function(){this.G=!0};var Fe=function(a){if("prerender"==J.webkitVisibilityState)return!1;a();return!0};var M=new $;var jf=W._gat;jf&&Ba(jf._getTracker)?M=jf:W._gat=M;var Z=new Y;(function(a){if(!Fe(a)){H(123);var b=!1,c=function(){!b&&Fe(a)&&(b=!0,Ha(J,"webkitvisibilitychange",c))};Ga(J,"webkitvisibilitychange",c)}})(function(){var a=W._gaq,b=!1;if(a&&Ba(a[n])&&(b="[object Array]"==Object[x][v].call(Object(a)),!b)){Z=a;return}W._gaq=Z;b&&Z[n][ya](Z,a)});function Yc(a){var b=1,c=0,d;if(a)for(b=0,d=a[w]-1;0<=d;d--)c=a.charCodeAt(d),b=(b<<6&268435455)+c+(c<<14),c=b&266338304,b=0!=c?b^c>>21:b;return b};})();

var gapi=window.gapi=window.gapi||{};gapi._bs=new Date().getTime();(function(){var aa=encodeURIComponent,k=window,ba=Object,p=document,ca=parseInt,q=String,da=decodeURIComponent;function ea(a,b){return a.type=b}
var fa="appendChild",s="push",t="test",ga="shift",ha="exec",ia="width",u="replace",ja="getElementById",ka="concat",la="charAt",ma="JSON",w="indexOf",na="nodeName",x="match",oa="readyState",z="createElement",A="setAttribute",pa="type",qa="bind",ra="getTime",sa="getElementsByTagName",B="substr",C="length",D="prototype",E="split",F="location",G="style",ta="removeChild",I="call",J="getAttribute",ua="protocol",va="charCodeAt",K="href",wa="substring",xa="action",L="apply",ya="attributes",M="parentNode",
za="update",Aa="height",N="join",Ba="toLowerCase",Ca=function(a,b,c){return a[I][L](a[qa],arguments)},Da=function(a,b,c){if(!a)throw Error();if(2<arguments[C]){var d=Array[D].slice[I](arguments,2);return function(){var c=Array[D].slice[I](arguments);Array[D].unshift[L](c,d);return a[L](b,c)}}return function(){return a[L](b,arguments)}},Ea=function(a,b,c){Ea=Function[D][qa]&&-1!=Function[D][qa].toString()[w]("native code")?Ca:Da;return Ea[L](null,arguments)};
Function[D].bind=Function[D][qa]||function(a,b){if(1<arguments[C]){var c=Array[D].slice[I](arguments,1);c.unshift(this,a);return Ea[L](null,c)}return Ea(this,a)};var O=k,P=p,Fa=O[F],Ga=function(){},Ha=/\[native code\]/,Q=function(a,b,c){return a[b]=a[b]||c},Ia=function(a){for(var b=0;b<this[C];b++)if(this[b]===a)return b;return-1},Ja=function(a){a=a.sort();for(var b=[],c=void 0,d=0;d<a[C];d++){var e=a[d];e!=c&&b[s](e);c=e}return b},Ka=/&/g,La=/</g,Ma=/>/g,Na=/"/g,Oa=/'/g,Pa=function(a){return q(a)[u](Ka,"&amp;")[u](La,"&lt;")[u](Ma,"&gt;")[u](Na,"&quot;")[u](Oa,"&#39;")},R=function(){var a;if((a=ba.create)&&Ha[t](a))a=a(null);else{a={};for(var b in a)a[b]=
void 0}return a},S=function(a,b){return ba[D].hasOwnProperty[I](a,b)},Qa=function(a){if(Ha[t](ba.keys))return ba.keys(a);var b=[],c;for(c in a)S(a,c)&&b[s](c);return b},T=function(a,b){a=a||{};for(var c in a)S(a,c)&&(b[c]=a[c])},Ra=function(a){return function(){O.setTimeout(a,0)}},Sa=function(a,b){if(!a)throw Error(b||"");},U=Q(O,"gapi",{});var V=function(a,b,c){var d=RegExp("([#].*&|[#])"+b+"=([^&#]*)","g");b=RegExp("([?#].*&|[?#])"+b+"=([^&#]*)","g");if(a=a&&(d[ha](a)||b[ha](a)))try{c=da(a[2])}catch(e){}return c},Ta=/^([^?#]*)(\?([^#]*))?(\#(.*))?$/,Ua=function(a){a=a[x](Ta);var b=R();b.R=a[1];b.g=a[3]?[a[3]]:[];b.l=a[5]?[a[5]]:[];return b},Va=function(a){return a.R+(0<a.g[C]?"?"+a.g[N]("&"):"")+(0<a.l[C]?"#"+a.l[N]("&"):"")},Wa=function(a,b){var c=[];if(a)for(var d in a)if(S(a,d)&&null!=a[d]){var e=b?b(a[d]):a[d];c[s](aa(d)+"="+aa(e))}return c},
Xa=function(a,b,c,d){a=Ua(a);a.g[s][L](a.g,Wa(b,d));a.l[s][L](a.l,Wa(c,d));return Va(a)},Ya=function(a,b){var c="";2E3<b[C]&&(c=b[wa](2E3),b=b[wa](0,2E3));var d=a[z]("div"),e=a[z]("a");e.href=b;d[fa](e);d.innerHTML=d.innerHTML;b=q(d.firstChild[K]);d[M]&&d[M][ta](d);return b+c},Za=/^https?:\/\/[^\/%\\?#\s]+\/[^\s]*$/i;var $a=function(a,b,c,d){if(O[c+"EventListener"])O[c+"EventListener"](a,b,!1);else if(O[d+"tachEvent"])O[d+"tachEvent"]("on"+a,b)},cb=function(a){var b=ab;if("complete"!==P[oa])try{b()}catch(c){}bb(a)},bb=function(a){if("complete"===P[oa])a();else{var b=!1,c=function(){if(!b)return b=!0,a[L](this,arguments)};O.addEventListener?(O.addEventListener("load",c,!1),O.addEventListener("DOMContentLoaded",c,!1)):O.attachEvent&&(O.attachEvent("onreadystatechange",function(){"complete"===P[oa]&&c[L](this,arguments)}),
O.attachEvent("onload",c))}},db=function(a){for(;a.firstChild;)a[ta](a.firstChild)},eb={button:!0,div:!0,span:!0};var W;W=Q(O,"___jsl",R());Q(W,"I",0);Q(W,"hel",10);var fb=function(a){return W.dpo?W.h:V(a,"jsh",W.h)},hb=function(a){var b=Q(W,"sws",[]);b[s][L](b,a)},ib=function(a){var b=Q(W,"PQ",[]);W.PQ=[];var c=b[C];if(0===c)a();else for(var d=0,e=function(){++d===c&&a()},f=0;f<c;f++)b[f](e)},jb=function(a){return Q(Q(W,"H",R()),a,R())};var kb=Q(W,"perf",R()),lb=Q(kb,"g",R()),mb=Q(kb,"i",R());Q(kb,"r",[]);R();R();var nb=function(a,b,c){var d=kb.r;"function"===typeof d?d(a,b,c):d[s]([a,b,c])},ob=function(a,b,c){lb[a]=!b&&lb[a]||c||(new Date)[ra]();nb(a)},qb=function(a,b,c){b&&0<b[C]&&(b=pb(b),c&&0<c[C]&&(b+="___"+pb(c)),28<b[C]&&(b=b[B](0,28)+(b[C]-28)),c=b,b=Q(mb,"_p",R()),Q(b,c,R())[a]=(new Date)[ra](),nb(a,"_p",c))},pb=function(a){return a[N]("__")[u](/\./g,"_")[u](/\-/g,"_")[u](/\,/g,"_")};var rb=R(),sb=[],X=function(a){throw Error("Bad hint"+(a?": "+a:""));};sb[s](["jsl",function(a){for(var b in a)if(S(a,b)){var c=a[b];"object"==typeof c?W[b]=Q(W,b,[])[ka](c):Q(W,b,c)}if(b=a.u)a=Q(W,"us",[]),a[s](b),(b=/^https:(.*)$/[ha](b))&&a[s]("http:"+b[1])}]);var tb=/^(\/[a-zA-Z0-9_\-]+)+$/,ub=/^[a-zA-Z0-9\-_\.!]+$/,vb=/^gapi\.loaded_[0-9]+$/,wb=/^[a-zA-Z0-9,._-]+$/,Ab=function(a,b,c,d){var e=a[E](";"),f=rb[e[ga]()],g=null;f&&(g=f(e,b,c,d));if(b=g)b=g,c=b[x](xb),d=b[x](yb),b=!!d&&1===d[C]&&zb[t](b)&&!!c&&1===c[C];b||X(a);return g},Db=function(a,b,c,d){a=Bb(a);vb[t](c)||X("invalid_callback");b=Cb(b);d=d&&d[C]?Cb(d):null;var e=function(a){return aa(a)[u](/%2C/g,",")};return[aa(a.S)[u](/%2C/g,",")[u](/%2F/g,"/"),"/k=",e(a.version),"/m=",e(b),d?"/exm="+e(d):
"","/rt=j/sv=1/d=1/ed=1",a.G?"/am="+e(a.G):"",a.H?"/rs="+e(a.H):"","/cb=",e(c)][N]("")},Bb=function(a){"/"!==a[la](0)&&X("relative path");for(var b=a[wa](1)[E]("/"),c=[];b[C];){a=b[ga]();if(!a[C]||0==a[w]("."))X("empty/relative directory");else if(0<a[w]("=")){b.unshift(a);break}c[s](a)}a={};for(var d=0,e=b[C];d<e;++d){var f=b[d][E]("="),g=da(f[0]),h=da(f[1]);2==f[C]&&g&&h&&(a[g]=a[g]||h)}b="/"+c[N]("/");tb[t](b)||X("invalid_prefix");c=Eb(a,"k",!0);d=Eb(a,"am");a=Eb(a,"rs");return{S:b,version:c,G:d,
H:a}},Cb=function(a){for(var b=[],c=0,d=a[C];c<d;++c){var e=a[c][u](/\./g,"_")[u](/-/g,"_");wb[t](e)&&b[s](e)}return b[N](",")},Eb=function(a,b,c){a=a[b];!a&&c&&X("missing: "+b);if(a){if(ub[t](a))return a;X("invalid: "+b)}return null},zb=/^https?:\/\/[a-z0-9_.-]+\.google\.com(:\d+)?\/[a-zA-Z0-9_.,!=\-\/]+$/,yb=/\/cb=/g,xb=/\/\//g,Fb=function(){var a=fb(Fa[K]);if(!a)throw Error("Bad hint");return a};rb.m=function(a,b,c,d){(a=a[0])||X("missing_hint");return"https://apis.google.com"+Db(a,b,c,d)};var Gb=decodeURI("%73cript"),Hb=function(a,b){for(var c=[],d=0;d<a[C];++d){var e=a[d];e&&0>Ia[I](b,e)&&c[s](e)}return c},Jb=function(a){"loading"!=P[oa]?Ib(a):P.write("<"+Gb+' src="'+encodeURI(a)+'"></'+Gb+">")},Ib=function(a){var b=P[z](Gb);b[A]("src",a);b.async="true";(a=P[sa](Gb)[0])?a[M].insertBefore(b,a):(P.head||P.body||P.documentElement)[fa](b)},Kb=function(a,b){var c=b&&b._c;if(c)for(var d=0;d<sb[C];d++){var e=sb[d][0],f=sb[d][1];f&&S(c,e)&&f(c[e],a,b)}},Mb=function(a,b){Lb(function(){var c;
c=b===fb(Fa[K])?Q(U,"_",R()):R();c=Q(jb(b),"_",c);a(c)})},Ob=function(a,b){var c=b||{};"function"==typeof b&&(c={},c.callback=b);Kb(a,c);var d=a?a[E](":"):[],e=c.h||Fb(),f=Q(W,"ah",R());if(f["::"]&&d[C]){for(var g=[],h=null;h=d[ga]();){var l=h[E]("."),l=f[h]||f[l[1]&&"ns:"+l[0]||""]||e,m=g[C]&&g[g[C]-1]||null,n=m;m&&m.hint==l||(n={hint:l,K:[]},g[s](n));n.K[s](h)}var y=g[C];if(1<y){var r=c.callback;r&&(c.callback=function(){0==--y&&r()})}for(;d=g[ga]();)Nb(d.K,c,d.hint)}else Nb(d||[],c,e)},Nb=function(a,
b,c){a=Ja(a)||[];var d=b.callback,e=b.config,f=b.timeout,g=b.ontimeout,h=null,l=!1;if(f&&!g||!f&&g)throw"Timeout requires both the timeout parameter and ontimeout parameter to be set";var m=Q(jb(c),"r",[]).sort(),n=Q(jb(c),"L",[]).sort(),y=[][ka](m),r=function(a,b){if(l)return 0;O.clearTimeout(h);n[s][L](n,v);var d=((U||{}).config||{})[za];d?d(e):e&&Q(W,"cu",[])[s](e);if(b){qb("me0",a,y);try{Mb(b,c)}finally{qb("me1",a,y)}}return 1};0<f&&(h=O.setTimeout(function(){l=!0;g()},f));var v=Hb(a,n);if(v[C]){var v=
Hb(a,m),H=Q(W,"CP",[]),Z=H[C];H[Z]=function(a){if(!a)return 0;qb("ml1",v,y);var b=function(b){H[Z]=null;r(v,a)&&ib(function(){d&&d();b()})},c=function(){var a=H[Z+1];a&&a()};0<Z&&H[Z-1]?H[Z]=function(){b(c)}:b(c)};if(v[C]){var gb="loaded_"+W.I++;U[gb]=function(a){H[Z](a);U[gb]=null};a=Ab(c,v,"gapi."+gb,m);m[s][L](m,v);qb("ml0",v,y);b.sync||O.___gapisync?Jb(a):Ib(a)}else H[Z](Ga)}else r(v)&&d&&d()};var Lb=function(a){if(W.hee&&0<W.hel)try{return a()}catch(b){W.hel--,Ob("debug_error",function(){try{k.___jsl.hefn(b)}catch(a){throw b;}})}else return a()};U.load=function(a,b){return Lb(function(){return Ob(a,b)})};var Pb=function(a){var b=k.___jsl=k.___jsl||{};b[a]=b[a]||[];return b[a]},Qb=function(a){var b=k.___jsl=k.___jsl||{};b.cfg=!a&&b.cfg||{};return b.cfg},Rb=function(a){return"object"===typeof a&&/\[native code\]/[t](a[s])},Sb=function(a,b){if(b)for(var c in b)b.hasOwnProperty(c)&&(a[c]&&b[c]&&"object"===typeof a[c]&&"object"===typeof b[c]&&!Rb(a[c])&&!Rb(b[c])?Sb(a[c],b[c]):b[c]&&"object"===typeof b[c]?(a[c]=Rb(b[c])?[]:{},Sb(a[c],b[c])):a[c]=b[c])},Tb=function(a){if(a&&!/^\s+$/[t](a)){for(;0==a[va](a[C]-
1);)a=a[wa](0,a[C]-1);var b;try{b=k[ma].parse(a)}catch(c){}if("object"===typeof b)return b;try{b=(new Function("return ("+a+"\n)"))()}catch(d){}if("object"===typeof b)return b;try{b=(new Function("return ({"+a+"\n})"))()}catch(e){}return"object"===typeof b?b:{}}},Ub=function(a){Qb(!0);var b=k.___gcfg,c=Pb("cu");if(b&&b!==k.___gu){var d={};Sb(d,b);c[s](d);k.___gu=b}var b=Pb("cu"),e=p.scripts||p[sa]("script")||[],d=[],f=[];f[s][L](f,Pb("us"));for(var g=0;g<e[C];++g)for(var h=e[g],l=0;l<f[C];++l)h.src&&
0==h.src[w](f[l])&&d[s](h);0==d[C]&&0<e[C]&&e[e[C]-1].src&&d[s](e[e[C]-1]);for(e=0;e<d[C];++e)d[e][J]("gapi_processed")||(d[e][A]("gapi_processed",!0),(f=d[e])?(g=f.nodeType,f=3==g||4==g?f.nodeValue:f.textContent||f.innerText||f.innerHTML||""):f=void 0,(f=Tb(f))&&b[s](f));a&&(d={},Sb(d,a),c[s](d));d=Pb("cd");a=0;for(b=d[C];a<b;++a)Sb(Qb(),d[a]);d=Pb("ci");a=0;for(b=d[C];a<b;++a)Sb(Qb(),d[a]);a=0;for(b=c[C];a<b;++a)Sb(Qb(),c[a])},Y=function(a){if(!a)return Qb();a=a[E]("/");for(var b=Qb(),c=0,d=a[C];b&&
"object"===typeof b&&c<d;++c)b=b[a[c]];return c===a[C]&&void 0!==b?b:void 0},Vb=function(a,b){var c=a;if("string"===typeof a){for(var d=c={},e=a[E]("/"),f=0,g=e[C];f<g-1;++f)var h={},d=d[e[f]]=h;d[e[f]]=b}Ub(c)};var Wb=function(){var a=k.__GOOGLEAPIS;a&&(a.googleapis&&!a["googleapis.config"]&&(a["googleapis.config"]=a.googleapis),Q(W,"ci",[])[s](a),k.__GOOGLEAPIS=void 0)};var Xb=k.console,Yb=function(a){Xb&&Xb.log&&Xb.log(a)};var Zb=function(){return!!W.oa},$b=function(){};var $=Q(W,"rw",R()),ac=function(a){for(var b in $)a($[b])},bc=function(a,b){var c=$[a];c&&c.state<b&&(c.state=b)};var cc;var dc=/^https?:\/\/(?:\w|[\-\.])+\.google\.(?:\w|[\-:\.])+(?:\/[^\?\#]*)?\/u\/(\d)\//,ec=/^https?:\/\/(?:\w|[\-\.])+\.google\.(?:\w|[\-:\.])+(?:\/[^\?\#]*)?\/b\/(\d{10,})\//,fc=function(a){var b=Y("googleapis.config/sessionIndex");null==b&&(b=k.__X_GOOG_AUTHUSER);if(null==b){var c=k.google;c&&(b=c.authuser)}null==b&&(a=a||k[F][K],b=V(a,"authuser")||null,null==b&&(b=(b=a[x](dc))?b[1]:null));return null==b?null:q(b)},gc=function(a){var b=Y("googleapis.config/sessionDelegate");null==b&&(b=(a=(a||k[F][K])[x](ec))?
a[1]:null);return null==b?null:q(b)};var hc=function(){};var ic=function(){this.b=[];this.n=[];this.N=[];this.k=[];this.k[0]=128;for(var a=1;64>a;++a)this.k[a]=0;this.reset()};(function(){function a(){}a.prototype=hc[D];ic.Z=hc[D];ic.prototype=new a})();ic[D].reset=function(){this.b[0]=1732584193;this.b[1]=4023233417;this.b[2]=2562383102;this.b[3]=271733878;this.b[4]=3285377520;this.o=this.i=0};
var jc=function(a,b,c){c||(c=0);var d=a.N;if("string"==typeof b)for(var e=0;16>e;e++)d[e]=b[va](c)<<24|b[va](c+1)<<16|b[va](c+2)<<8|b[va](c+3),c+=4;else for(e=0;16>e;e++)d[e]=b[c]<<24|b[c+1]<<16|b[c+2]<<8|b[c+3],c+=4;for(e=16;80>e;e++){var f=d[e-3]^d[e-8]^d[e-14]^d[e-16];d[e]=(f<<1|f>>>31)&4294967295}b=a.b[0];c=a.b[1];for(var g=a.b[2],h=a.b[3],l=a.b[4],m,e=0;80>e;e++)40>e?20>e?(f=h^c&(g^h),m=1518500249):(f=c^g^h,m=1859775393):60>e?(f=c&g|h&(c|g),m=2400959708):(f=c^g^h,m=3395469782),f=(b<<5|b>>>27)+
f+l+m+d[e]&4294967295,l=h,h=g,g=(c<<30|c>>>2)&4294967295,c=b,b=f;a.b[0]=a.b[0]+b&4294967295;a.b[1]=a.b[1]+c&4294967295;a.b[2]=a.b[2]+g&4294967295;a.b[3]=a.b[3]+h&4294967295;a.b[4]=a.b[4]+l&4294967295};ic[D].update=function(a,b){void 0===b&&(b=a[C]);for(var c=b-64,d=0,e=this.n,f=this.i;d<b;){if(0==f)for(;d<=c;)jc(this,a,d),d+=64;if("string"==typeof a)for(;d<b;){if(e[f]=a[va](d),++f,++d,64==f){jc(this,e);f=0;break}}else for(;d<b;)if(e[f]=a[d],++f,++d,64==f){jc(this,e);f=0;break}}this.i=f;this.o+=b};var kc=function(){this.p=new ic};kc[D].reset=function(){this.p.reset()};var rc=function(){var a;lc?(a=new O.Uint32Array(1),mc.getRandomValues(a),a=Number("0."+a[0])):(a=nc,a+=ca(oc[B](0,20),16),oc=pc(oc),a/=qc+Math.pow(16,20));return a},mc=O.crypto,lc=!1,sc=0,tc=0,nc=1,qc=0,oc="",uc=function(a){a=a||O.event;var b=a.screenX+a.clientX<<16,b=b+(a.screenY+a.clientY),b=b*((new Date)[ra]()%1E6);nc=nc*b%qc;0<sc&&++tc==sc&&$a("mousemove",uc,"remove","de")},pc=function(a){var b=new kc;a=unescape(aa(a));for(var c=[],d=0,e=a[C];d<e;++d)c[s](a[va](d));b.p[za](c);a=b.p;b=[];d=8*a.o;
56>a.i?a[za](a.k,56-a.i):a[za](a.k,64-(a.i-56));for(c=63;56<=c;c--)a.n[c]=d&255,d/=256;jc(a,a.n);for(c=d=0;5>c;c++)for(e=24;0<=e;e-=8)b[d]=a.b[c]>>e&255,++d;a="";for(c=0;c<b[C];c++)a+="0123456789ABCDEF"[la](Math.floor(b[c]/16))+"0123456789ABCDEF"[la](b[c]%16);return a},lc=!!mc&&"function"==typeof mc.getRandomValues;lc||(qc=1E6*(screen[ia]*screen[ia]+screen[Aa]),oc=pc(P.cookie+"|"+P[F]+"|"+(new Date)[ra]()+"|"+Math.random()),sc=Y("random/maxObserveMousemove")||0,0!=sc&&$a("mousemove",uc,"add","at"));var vc=function(){var a=W.onl;if(!a){a=R();W.onl=a;var b=R();a.e=function(a){var d=b[a];d&&(delete b[a],d())};a.a=function(a,d){b[a]=d};a.r=function(a){delete b[a]}}return a},wc=function(a,b){var c=b.onload;return"function"===typeof c?(vc().a(a,c),c):null},xc=function(a){Sa(/^\w+$/[t](a),"Unsupported id - "+a);vc();return'onload="window.___jsl.onl.e(&#34;'+a+'&#34;)"'},yc=function(a){vc().r(a)};var zc={allowtransparency:"true",frameborder:"0",hspace:"0",marginheight:"0",marginwidth:"0",scrolling:"no",style:"",tabindex:"0",vspace:"0",width:"100%"},Ac={allowtransparency:!0,onload:!0},Bc=0,Cc=function(a){Sa(!a||Za[t](a),"Illegal url for new iframe - "+a)},Dc=function(a,b,c,d,e){Cc(c.src);var f,g=wc(d,c),h=g?xc(d):"";try{f=a[z]('<iframe frameborder="'+Pa(q(c.frameborder))+'" scrolling="'+Pa(q(c.scrolling))+'" '+h+' name="'+Pa(q(c.name))+'"/>')}catch(l){f=a[z]("iframe"),g&&(f.onload=function(){f.onload=
null;g[I](this)},yc(d))}for(var m in c)a=c[m],"style"===m&&"object"===typeof a?T(a,f[G]):Ac[m]||f[A](m,q(a));(m=e&&e.beforeNode||null)||e&&e.dontclear||db(b);b.insertBefore(f,m);f=m?m.previousSibling:b.lastChild;c.allowtransparency&&(f.allowTransparency=!0);return f};var Ec=/^:[\w]+$/,Fc=/:([a-zA-Z_]+):/g,Gc=function(a,b){if(!cc||Y("oauth-flow/authAware")){var c=fc()||"0",d=gc(),e;e=fc(void 0)||c;var f=gc(void 0),g="";e&&(g+="u/"+e+"/");f&&(g+="b/"+f+"/");e=g||null;f=Y("oauth-flow/authAware")?"isLoggedIn":"googleapis.config/signedIn";(f=!1===Y(f)?"_/im/":"")&&(e="");cc={socialhost:Y("iframes/:socialhost:"),session_index:c,session_delegate:d,session_prefix:e,im_prefix:f}}return cc[b]||""};var Hc=function(a){var b;a[x](/^https?%3A/i)&&(b=da(a));return Ya(p,b?b:a)},Ic=function(a){a=a||"canonical";for(var b=p[sa]("link"),c=0,d=b[C];c<d;c++){var e=b[c],f=e[J]("rel");if(f&&f[Ba]()==a&&(e=e[J]("href"))&&(e=Hc(e))&&null!=e[x](/^https?:\/\/[\w\-\_\.]+/i))return e}return k[F][K]};var Jc={post:!0},Kc={style:"position:absolute;top:-10000px;width:450px;margin:0px;border-style:none"},Lc="onPlusOne _ready _close _open _resizeMe _renderstart oncircled drefresh erefresh".split(" "),Mc=Q(W,"WI",R()),Nc=function(a,b,c){var d,e;d=e=a;"plus"==a&&b[xa]&&(e=a+"_"+b[xa],d=a+"/"+b[xa]);(e=Y("iframes/"+e+"/url"))||(e=":socialhost:/_/widget/render/"+d);d=Ya(P,e[u](Fc,Gc));e={};T(b,e);e.hl=Y("lang")||Y("gwidget/lang")||"en-US";Jc[a]||(e.origin=k[F].origin||k[F][ua]+"//"+k[F].host);e.exp=Y("iframes/"+
a+"/params/exp");var f=Y("iframes/"+a+"/params/location");if(f)for(var g=0;g<f[C];g++){var h=f[g];e[h]=O[F][h]}switch(a){case "plus":case "follow":f=e[K];g=b[xa]?void 0:"publisher";f=(f="string"==typeof f?f:void 0)?Hc(f):Ic(g);e.url=f;delete e[K];break;case "plusone":e.url=b[K]?Hc(b[K]):Ic();f=b.db;g=Y();null==f&&g&&(f=g.db,null==f&&(f=g.gwidget&&g.gwidget.db));e.db=f||void 0;f=b.ecp;g=Y();null==f&&g&&(f=g.ecp,null==f&&(f=g.gwidget&&g.gwidget.ecp));e.ecp=f||void 0;delete e[K];break;case "signin":e.url=
Ic()}W.ILI&&(e.iloader="1");delete e["data-onload"];delete e.rd;e.gsrc=Y("iframes/:source:");f=Y("inline/css");"undefined"!==typeof f&&0<c&&f>=c&&(e.ic="1");f=/^#|^fr-/;c={};for(var l in e)S(e,l)&&f[t](l)&&(c[l[u](f,"")]=e[l],delete e[l]);l=[][ka](Lc);(f=Y("iframes/"+a+"/methods"))&&"object"===typeof f&&Ha[t](f[s])&&(l=l[ka](f));for(var m in b)S(b,m)&&/^on/[t](m)&&("plus"!=a||"onconnect"!=m)&&(l[s](m),delete e[m]);delete e.callback;c._methods=l[N](",");return Xa(d,e,c)},Oc=["style","data-gapiscan"],
Qc=function(a){for(var b=R(),c=0!=a[na][Ba]()[w]("g:"),d=0,e=a[ya][C];d<e;d++){var f=a[ya][d],g=f.name,h=f.value;0<=Ia[I](Oc,g)||c&&0!=g[w]("data-")||"null"===h||"specified"in f&&!f.specified||(c&&(g=g[B](5)),b[g[Ba]()]=h)}a=a[G];(c=Pc(a&&a[Aa]))&&(b.height=q(c));(a=Pc(a&&a[ia]))&&(b.width=q(a));return b},Pc=function(a){var b=void 0;"number"===typeof a?b=a:"string"===typeof a&&(b=ca(a,10));return b},Sc=function(){var a=W.drw;ac(function(b){if(a!==b.id&&4!=b.state){var c=b.id,d=b[pa],e=b.url;b=b.userParams;
var f=P[ja](c);if(f){var g=Nc(d,b,0);g?(f=f[M],e[u](/\#.*/,"")[u](/(\?|&)ic=1/,"")!==g[u](/\#.*/,"")[u](/(\?|&)ic=1/,"")&&(b.dontclear=!0,b.rd=!0,b.ri=!0,ea(b,d),Rc(f,b),(d=$[f.lastChild.id])&&(d.oid=c),bc(c,4))):delete $[c]}else delete $[c]}})},Tc=function(){};var Uc,Vc,Wc,Xc,Yc,Zc=/(?:^|\s)g-((\S)*)(?:$|\s)/,$c={plusone:!0,autocomplete:!0,profile:!0,identity:!0};Uc=Q(W,"SW",R());Vc=Q(W,"SA",R());Wc=Q(W,"SM",R());Xc=Q(W,"FW",[]);Yc=null;
var bd=function(a,b){ad(void 0,!1,a,b)},ad=function(a,b,c,d){ob("ps0",!0);c=("string"===typeof c?p[ja](c):c)||P;var e;e=P.documentMode;if(c.querySelectorAll&&(!e||8<e)){e=d?[d]:Qa(Uc)[ka](Qa(Vc))[ka](Qa(Wc));for(var f=[],g=0;g<e[C];g++){var h=e[g];f[s](".g-"+h,"g\\:"+h)}e=c.querySelectorAll(f[N](","))}else e=c[sa]("*");c=R();for(f=0;f<e[C];f++){g=e[f];var l=g,h=d,m=l[na][Ba](),n=void 0;l[J]("data-gapiscan")?h=null:(0==m[w]("g:")?n=m[B](2):(l=(l=q(l.className||l[J]("class")))&&Zc[ha](l))&&(n=l[1]),
h=!n||!(Uc[n]||Vc[n]||Wc[n])||h&&n!==h?null:n);h&&($c[h]||0==g[na][Ba]()[w]("g:")||0!=Qa(Qc(g))[C])&&(g[A]("data-gapiscan",!0),Q(c,h,[])[s](g))}if(b)for(var y in c)for(b=c[y],d=0;d<b[C];d++)b[d][A]("data-onload",!0);for(var r in c)Xc[s](r);ob("ps1",!0);if((y=Xc[N](":"))||a)try{U.load(y,a)}catch(v){Yb(v);return}if(cd(Yc||{}))for(var H in c){a=c[H];r=0;for(b=a[C];r<b;r++)a[r].removeAttribute("data-gapiscan");dd(H)}else{d=[];for(H in c)for(a=c[H],r=0,b=a[C];r<b;r++)e=a[r],ed(H,e,Qc(e),d,b);fd(y,d)}},
gd=function(a){var b=Q(U,a,{});b.go||(b.go=function(b){return bd(b,a)},b.render=function(b,d){var e=d||{};ea(e,a);return Rc(b,e)})},hd=function(a){Uc[a]=!0},id=function(a){Vc[a]=!0},jd=function(a){Wc[a]=!0};var dd=function(a,b){var c=Q(W,"watt",R())[a];b&&c?(c(b),(c=b.iframeNode)&&c[A]("data-gapiattached",!0)):U.load(a,function(){var c=Q(W,"watt",R())[a],e=b&&b.iframeNode;e&&c?(c(b),e[A]("data-gapiattached",!0)):(0,U[a].go)(e&&e[M])})},cd=function(){return!1},fd=function(){},ed=function(a,b,c,d,e,f){switch(kd(b,a,f)){case 0:a=Wc[a]?a+"_annotation":a;d={};d.iframeNode=b;d.userParams=c;dd(a,d);break;case 1:if(b[M]){f=!0;c.dontclear&&(f=!1);delete c.dontclear;var g=Nc(a,c,e);e={allowPost:1,attributes:Kc};
e.dontclear=!f;f={};f.userParams=c;f.url=g;ea(f,a);var h;c.rd?h=b:(h=p[z]("div"),b[A]("data-gapistub",!0),h[G].cssText="position:absolute;width:450px;left:-10000px;",b[M].insertBefore(h,b));f.siteElement=h;if(!h.id){b=h;var l;Q(Mc,a,0);l="___"+a+"_"+Mc[a]++;b.id=l}b=R();b[">type"]=a;T(c,b);$b();var m;l=g;c=h;g=e||{};e=g[ya]||{};Sa(!g.allowPost||!e.onload,"onload is not supported by post iframe");b=e=l;Ec[t](e)&&(b=Y("iframes/"+b[wa](1)+"/url"),Sa(!!b,"Unknown iframe url config for - "+e));l=Ya(P,
b[u](Fc,Gc));e=c.ownerDocument||P;h=0;do b=g.id||["I",Bc++,"_",(new Date)[ra]()][N]("");while(e[ja](b)&&5>++h);Sa(5>h,"Error creating iframe id");h={};var n={};T(g.queryParams||{},h);T(g.fragmentParams||{},n);var y=g.pfname,r=R();r.id=b;r.parent=e[F][ua]+"//"+e[F].host;var v=V(e[F][K],"parent"),y=y||"";!y&&v&&(v=V(e[F][K],"id",""),y=V(e[F][K],"pfname",""),y=v?y+"/"+v:"");r.pfname=y;T(r,n);(r=V(l,"rpctoken")||h.rpctoken||n.rpctoken)||(r=n.rpctoken=g.rpctoken||q(Math.round(1E8*rc())));g.rpctoken=r;
v=e[F][K];r=R();(y=V(v,"_bsh",W.bsh))&&(r._bsh=y);(v=fb(v))&&(r.jsh=v);g.hintInFragment?T(r,n):T(r,h);l=Xa(l,h,n,g.paramsSerializer);n=R();T(zc,n);T(g[ya],n);n.name=n.id=b;n.src=l;g.eurl=l;if((g||{}).allowPost&&2E3<l[C]){h=Ua(l);n.src="";n["data-postorigin"]=l;l=Dc(e,c,n,b);-1!=navigator.userAgent[w]("WebKit")&&(m=l.contentWindow.document,m.open(),n=m[z]("div"),r={},v=b+"_inner",r.name=v,r.src="",r.style="display:none",Dc(e,n,r,v,g));n=(g=h.g[0])?g[E]("&"):[];g=[];for(r=0;r<n[C];r++)v=n[r][E]("=",
2),g[s]([da(v[0]),da(v[1])]);h.g=[];n=Va(h);h=e[z]("form");h.action=n;h.method="POST";h.target=b;h[G].display="none";for(b=0;b<g[C];b++)n=e[z]("input"),ea(n,"hidden"),n.name=g[b][0],n.value=g[b][1],h[fa](n);c[fa](h);h.submit();h[M][ta](h);m&&m.close();m=l}else m=Dc(e,c,n,b,g);f.iframeNode=m;f.id=m[J]("id");m=f.id;c=R();c.id=m;c.userParams=f.userParams;c.url=f.url;ea(c,f[pa]);c.state=1;$[m]=c}else f=null;f&&((m=f.id)&&d[s](m),dd(a,f))}},kd=function(a,b,c){if(a&&1===a.nodeType&&b){if(c)return 1;if(Wc[b]){if(eb[a[na][Ba]()])return(a=
a.innerHTML)&&a[u](/^[\s\xa0]+|[\s\xa0]+$/g,"")?0:1}else{if(Vc[b])return 0;if(Uc[b])return 1}}return null},Rc=function(a,b){var c=b[pa];delete b[pa];var d=("string"===typeof a?p[ja](a):a)||void 0;if(d){var e={},f;for(f in b)S(b,f)&&(e[f[Ba]()]=b[f]);e.rd=1;(f=!!e.ri)&&delete e.ri;var g=[];ed(c,d,e,g,0,f);fd(c,g)}else Yb("string"==="gapi."+c+".render: missing element "+typeof a?a:"")};Q(U,"platform",{}).go=bd;var cd=function(a){for(var b=["_c","jsl","h"],c=0;c<b[C]&&a;c++)a=a[b[c]];b=fb(Fa[K]);return!a||0!=a[w]("n;")&&0!=b[w]("n;")&&a!==b},fd=function(a,b){ld(a,b)},ab=function(a){ad(a,!0)},md=function(a,b){for(var c=b||[],d=0;d<c[C];++d)a(c[d]);for(d=0;d<c[C];d++)gd(c[d])};sb[s](["platform",function(a,b,c){Yc=c;b&&Xc[s](b);md(hd,a);md(id,c._c.annotation);md(jd,c._c.bimodal);Wb();Ub();if("explicit"!=Y("parsetags")){hb(a);var d;c&&(a=c.callback)&&(d=Ra(a),delete c.callback);cb(function(){ab(d)})}}]);var nd=function(a){a=(a=$[a])?a.oid:void 0;if(a){var b=P[ja](a);b&&b[M][ta](b);delete $[a];nd(a)}},Tc=function(a,b,c){if(c[ia]&&c[Aa]){n:{c=c||{};if(Zb()){var d=b.id;if(d){var e;e=(e=$[d])?e.state:void 0;if(1===e||4===e)break n;nd(d)}}(e=a.nextSibling)&&e[J]&&e[J]("data-gapistub")&&(a[M][ta](e),a[G].cssText="");e=c[ia];var f=c[Aa],g=a[G];g.textIndent="0";g.margin="0";g.padding="0";g.background="transparent";g.borderStyle="none";g.cssFloat="none";g.styleFloat="none";g.lineHeight="normal";g.fontSize=
"1px";g.verticalAlign="baseline";a=a[G];a.display="inline-block";g=b[G];g.position="static";g.left=0;g.top=0;g.visibility="visible";e&&(a.width=g.width=e+"px");f&&(a.height=g.height=f+"px");c.verticalAlign&&(a.verticalAlign=c.verticalAlign);d&&bc(d,3)}b["data-csi-wdt"]=(new Date)[ra]()}};var od=/^\{h\:'/,pd=/^!_/,qd="",ld=function(a,b){function c(){$a("message",d,"remove","de")}function d(d){var g=d.data,h=d.origin;if(rd(g,b)){var l=e;e=!1;l&&ob("rqe");sd(a,function(){l&&ob("rqd");c();for(var a=Q(W,"RPMQ",[]),b=0;b<a[C];b++)a[b]({data:g,origin:h})})}}if(0!==b[C]&&k[ma]&&k[ma].parse){qd=V(Fa[K],"pfname","");var e=!0;$a("message",d,"add","at");Ob(a,c)}},rd=function(a,b){a=q(a);if(od[t](a))return!0;var c=!1;pd[t](a)&&(c=!0,a=a[B](2));if(!/^\{/[t](a))return!1;try{var d=k[ma].parse(a)}catch(e){return!1}if(!d)return!1;
var f=d.f;if(d.s&&f&&-1!=Ia[I](b,f)){if("_renderstart"===d.s||d.s===qd+"/"+f+"::_renderstart")c=d.a&&d.a[c?0:1],d=P[ja](f),bc(f,2),c&&d&&Tc(d[M],d,c);return!0}return!1},sd=function(a,b){Ob(a,b)};var td=function(a,b){this.A=a;var c=b||{};this.P=c.V;this.w=c.domain;this.B=c.path;this.Q=c.W},ud=/^[-+/_=.:|%&a-zA-Z0-9@]*$/,vd=/^[A-Z_][A-Z0-9_]{0,63}$/;td[D].write=function(a,b){if(!vd[t](this.A))throw"Invalid cookie name";if(!ud[t](a))throw"Invalid cookie value";var c=this.A+"="+a;this.w&&(c+=";domain="+this.w);this.B&&(c+=";path="+this.B);var d="number"===typeof b?b:this.P;if(0<=d){var e=new Date;e.setSeconds(e.getSeconds()+d);c+=";expires="+e.toUTCString()}this.Q&&(c+=";secure");p.cookie=c};
td.iterate=function(a){for(var b=p.cookie[E](/;\s*/),c=0;c<b[C];++c){var d=b[c][E]("="),e=d[ga]();a(e,d[N]("="))}};var wd=function(a){this.T=a},xd={};wd[D].write=function(a){xd[this.T]=a};wd.iterate=function(a){for(var b in xd)xd.hasOwnProperty(b)&&a(b,xd[b])};var yd="https:"===k[F][ua],zd=yd||"http:"===k[F][ua]?td:wd,Ad=function(a){var b=a[B](1),c="",d=k[F].hostname;if(""!==b){c=ca(b,10);if(isNaN(c))return null;b=d[E](".");if(b[C]<c-1)return null;b[C]==c-1&&(d="."+d)}else d="";return{c:"S"==a[la](0),domain:d,d:c}},Bd=function(a){if(0!==a[w]("GCSC"))return null;var b={v:!1};a=a[B](4);if(!a)return b;var c=a[la](0);a=a[B](1);var d=a.lastIndexOf("_");if(-1==d)return b;var e=Ad(a[B](d+1));if(null==e)return b;a=a[wa](0,d);if("_"!==a[la](0))return b;d="E"===
c&&e.c;return!d&&("U"!==c||e.c)||d&&!yd?b:{v:!0,c:d,U:a[B](1),domain:e.domain,d:e.d}},Cd=function(a){if(!a)return[];a=a[E]("=");return a[1]?a[1][E]("|"):[]},Dd=function(a){a=a[E](":");return{q:a[0][E]("=")[1],L:Cd(a[1]),Y:Cd(a[2]),X:Cd(a[3])}},Ed=function(){var a,b=null;zd.iterate(function(c,d){if(0===c[w]("G_AUTHUSER_")){var e=Ad(c[wa](11));if(!a||e.c&&!a.c||e.c==a.c&&e.d>a.d)a=e,b=d}});if(null!==b){var c;zd.iterate(function(b,d){var e=Bd(b);e&&e.v&&e.c==a.c&&e.d==a.d&&(c=d)});if(c){var d=Dd(c),
e=d&&d.L[Number(b)],d=d&&d.q;if(e)return{M:b,O:e,q:d}}}return null};var Fd=function(a){this.F=a};Fd[D].j=0;Fd[D].D=2;Fd[D].F=null;Fd[D].t=!1;Fd[D].J=function(){this.t||(this.j=0,this.t=!0,this.C())};Fd[D].C=function(){this.t&&(this.F()?this.j=this.D:this.j=Math.min(2*(this.j||this.D),120),k.setTimeout(Ea(this.C,this),1E3*this.j))};for(var Gd=0;64>Gd;++Gd);var Hd=null,Zb=function(){return W.oa=!0},$b=function(){W.oa=!0;var a=Ed();(a=a&&a.M)&&Vb("googleapis.config/sessionIndex",a);Hd||(Hd=Q(W,"ss",new Fd(Id)));a=Hd;a.J&&a.J()},Id=function(){var a=Ed(),b=a&&a.O||null,c=a&&a.q;Ob("auth",{callback:function(){var a={client_id:c,session_state:b};O.gapi.auth.checkSessionState(a,function(b){var c=a.session_state,g=Y("isLoggedIn");b=c&&b||!c&&!b;g!=b&&(Vb("isLoggedIn",b),$b(),Sc())})}});return!0};ob("bs0",!0,k.gapi._bs);ob("bs1",!0);delete k.gapi._bs;})();
gapi.load("plusone",{callback:window["gapi_onload"],_c:{"jsl":{"ci":{"":{"enableMultilogin":false},"client":{"cors":false},"plus_layer":{"isEnabled":false},"isLoggedIn":true,"iframes":{"additnow":{"methods":["launchurl"],"url":"https://apis.google.com/additnow/additnow.html?bsv\u003do"},"plus_followers":{"params":{"url":""},"url":":socialhost:/_/im/_/widget/render/plus/followers?bsv\u003do"},"signin":{"methods":["onauth"],"params":{"url":""},"url":":socialhost:/:session_prefix:_/widget/render/signin?bsv\u003do"},"commentcount":{"url":":socialhost:/:session_prefix:_/widget/render/commentcount?bsv\u003do"},"plus_circle":{"params":{"url":""},"url":":socialhost:/:session_prefix:_/widget/plus/circle?bsv\u003do"},"hangout":{"url":"https://talkgadget.google.com/:session_prefix:talkgadget/_/widget?bsv\u003do"},"evwidget":{"params":{"url":""},"url":":socialhost:/:session_prefix:_/events/widget?bsv\u003do"},"zoomableimage":{"url":"https://ssl.gstatic.com/microscope/embed/?bsv\u003do"},"card":{"url":":socialhost:/:session_prefix:_/hovercard/card?bsv\u003do"},"shortlists":{"url":"?bsv\u003do"},"plus":{"methods":["onauth"],"url":":socialhost:/u/:session_index:/_/pages/badge?bsv\u003do"},":socialhost:":"https://apis.google.com","rbr_s":{"params":{"url":""},"url":":socialhost:/:session_prefix:_/widget/render/recobarsimplescroller?bsv\u003do"},"autocomplete":{"params":{"url":""},"url":":socialhost:/:session_prefix:_/widget/render/autocomplete?bsv\u003do"},"plus_share":{"params":{"url":""},"url":":socialhost:/:session_prefix:_/+1/sharebutton?plusShare\u003dtrue\u0026bsv\u003do"},":source:":"3p","rbr_i":{"params":{"url":""},"url":":socialhost:/:session_prefix:_/widget/render/recobarinvitation?bsv\u003do"},"panoembed":{"url":"https://ssl.gstatic.com/pano/embed/?bsv\u003do"},"savetowallet":{"url":"https://clients5.google.com/s2w/o/savetowallet?bsv\u003do"},"appcirclepicker":{"url":":socialhost:/:session_prefix:_/widget/render/appcirclepicker?bsv\u003do"},"savetodrive":{"methods":["save"],"url":"https://drive.google.com/savetodrivebutton?usegapi\u003d1\u0026bsv\u003do"},":signuphost:":"https://plus.google.com","plusone":{"preloadUrl":["https://ssl.gstatic.com/s2/oz/images/stars/po/Publisher/sprite4-a67f741843ffc4220554c34bd01bb0bb.png"],"params":{"count":"","size":"","url":""},"url":":socialhost:/:session_prefix:_/+1/fastbutton?bsv\u003do\u0026usegapi\u003d1"},"comments":{"methods":["scroll","openwindow"],"params":{"location":["search","hash"]},"url":":socialhost:/:session_prefix:_/widget/render/comments?bsv\u003do"},"ytsubscribe":{"url":"https://www.youtube.com/subscribe_embed?bsv\u003do\u0026usegapi\u003d1"}},"isPlusUser":false,"debug":{"host":"https://apis.google.com","reportExceptionRate":0.05,"rethrowException":false},"deviceType":"desktop","inline":{"css":1},"lexps":[102,98,99,111,79,109,45,17,117,86,115,81,95,122,61,30],"oauth-flow":{"authAware":true,"eso":false,"disableOpt":true,"authUrl":"https://accounts.google.com/o/oauth2/auth","proxyUrl":"https://accounts.google.com/o/oauth2/postmessageRelay","toastCfg":"1000:3000:1000"},"report":{"host":"https://apis.google.com","rate":0.001,"apis":["iframes\\..*","gadgets\\..*","gapi\\.appcirclepicker\\.*","gapi\\.client\\..*"]},"csi":{"rate":0.01},"googleapis.config":{}},"h":"m;/_/scs/apps-static/_/js/k\u003doz.gapi.es.Mow88VoEROI.O/m\u003d__features__/am\u003dIQ/rt\u003dj/d\u003d1/rs\u003dAItRSTMjovOChYYqj-2fHUR9er0RaZw38g","u":"https://apis.google.com/js/plusone.js","hee":true,"fp":"04d88e8c5734163249373dd83873783f090a057e","dpo":false},"platform":["additnow","comments","commentcount","community","follow","page","panoembed","person","plus","plusone","savetodrive","shortlists","ytsubscribe","zoomableimage","savetowallet","hangout"],"fp":"04d88e8c5734163249373dd83873783f090a057e","annotation":["interactivepost","recobar","autocomplete","profile"],"bimodal":["signin"]}});
(function(e,t){function y(e){for(var t=1,n;n=arguments[t];t++)for(var r in n)e[r]=n[r];return e}function b(e){return Array.prototype.slice.call(e)}function E(e,t){for(var n=0,r;r=e[n];n++)if(t==r)return n;return-1}function S(){var e=b(arguments),t=[];for(var n=0,r=e.length;n<r;n++)e[n].length>0&&t.push(e[n].replace(/\/$/,""));return t.join("/")}function x(e,t,n){var r=t.split("/"),i=e;while(r.length>1){var s=r.shift();i=i[s]=i[s]||{}}i[r[0]]=n}function T(){}function N(e,t){this.id=this.path=e,this.force=!!t}function C(e,t){this.id=e,this.body=t,typeof t=="undefined"&&(this.path=this.resolvePath(e))}function k(e,t){this.deps=e,this.collectResults=t,this.deps.length==0&&this.complete()}function L(e,t){this.deps=e,this.collectResults=t}function A(){for(var e in r)if(r[e].readyState=="interactive")return c[r[e].id]}function O(e,t){var r;return!e&&n&&(r=l||A()),r?(delete c[r.scriptId],r.body=t,r.execute()):(f=r=new C(e,t),a[r.id]=r),r}function M(){var e=b(arguments),t,n;return typeof e[0]=="string"&&(t=e.shift()),n=e.shift(),O(t,n)}function _(e,t){var n=t.id||"",r=n.split("/");r.pop();var i=r.join("/");return e.replace(/^\./,i)}function D(e,t){function r(e){return C.exports[_(e,t)]}var n=[];for(var i=0,s=e.length;i<s;i++){if(e[i]=="require"){n.push(r);continue}if(e[i]=="exports"){t.exports=t.exports||{},n.push(t.exports);continue}n.push(r(e[i]))}return n}function P(){var e=b(arguments),t=[],n,r;return typeof e[0]=="string"&&(n=e.shift()),w(e[0])&&(t=e.shift()),r=e.shift(),O(n,function(e){function s(){var i=D(b(t),n),s;typeof r=="function"?s=r.apply(n,i):s=r,typeof s=="undefined"&&(s=n.exports),e(s)}var n=this,i=[];for(var o=0,u=t.length;o<u;o++){var a=t[o];E(["require","exports"],a)==-1&&i.push(_(a,n))}i.length>0?H.apply(this,i.concat(s)):s()})}function H(){var e=b(arguments),t,n;typeof e[e.length-1]=="function"&&(t=e.pop()),typeof e[e.length-1]=="boolean"&&(n=e.pop());var r=new k(B(e,n),n);return t&&r.then(t),r}function B(e,t){var n=[];for(var r=0,i;i=e[r];r++)typeof i=="string"&&(i=j(i)),w(i)&&(i=new L(B(i,t),t)),n.push(i);return n}function j(e){var t,n;for(var r=0,i;i=H.matchers[r];r++){var s=i[0],o=i[1];if(t=e.match(s))return o(e)}throw new Error(e+" was not recognised by loader")}function I(){return e.using=h,e.provide=p,e.define=d,e.loadrunner=v,F}function q(e){for(var t=0;t<H.bundles.length;t++)for(var n in H.bundles[t])if(n!=e&&E(H.bundles[t][n],e)>-1)return n}var n=e.attachEvent&&!e.opera,r=t.getElementsByTagName("script"),i=0,s,o=t.createElement("script"),u={},a={},f,l,c={},h=e.using,p=e.provide,d=e.define,v=e.loadrunner;for(var m=0,g;g=r[m];m++)if(g.src.match(/loadrunner\.js(\?|#|$)/)){s=g;break}var w=Array.isArray||function(e){return e.constructor==Array};T.prototype.then=function(t){var n=this;return this.started||(this.started=!0,this.start()),this.completed?t.apply(e,this.results):(this.callbacks=this.callbacks||[],this.callbacks.push(t)),this},T.prototype.start=function(){},T.prototype.complete=function(){if(!this.completed){this.results=b(arguments),this.completed=!0;if(this.callbacks)for(var t=0,n;n=this.callbacks[t];t++)n.apply(e,this.results)}},N.loaded=[],N.prototype=new T,N.prototype.start=function(){var e=this,t,n,r;return(r=a[this.id])?(r.then(function(){e.complete()}),this):((t=u[this.id])?t.then(function(){e.loaded()}):!this.force&&E(N.loaded,this.id)>-1?this.loaded():(n=q(this.id))?H(n,function(){e.loaded()}):this.load(),this)},N.prototype.load=function(){var t=this;u[this.id]=t;var n=o.cloneNode(!1);this.scriptId=n.id="LR"+ ++i,n.type="text/javascript",n.async=!0,n.onerror=function(){throw new Error(t.path+" not loaded")},n.onreadystatechange=n.onload=function(n){n=e.event||n;if(n.type=="load"||E(["loaded","complete"],this.readyState)>-1)this.onreadystatechange=null,t.loaded()},n.src=this.path,l=this,r[0].parentNode.insertBefore(n,r[0]),l=null,c[n.id]=this},N.prototype.loaded=function(){this.complete()},N.prototype.complete=function(){E(N.loaded,this.id)==-1&&N.loaded.push(this.id),delete u[this.id],T.prototype.complete.apply(this,arguments)},C.exports={},C.prototype=new N,C.prototype.resolvePath=function(e){return S(H.path,e+".js")},C.prototype.start=function(){var e,t,n=this,r;this.body?this.execute():(e=C.exports[this.id])?this.exp(e):(t=a[this.id])?t.then(function(e){n.exp(e)}):(bundle=q(this.id))?H(bundle,function(){n.start()}):(a[this.id]=this,this.load())},C.prototype.loaded=function(){var e,t,r=this;n?(t=C.exports[this.id])?this.exp(t):(e=a[this.id])&&e.then(function(e){r.exp(e)}):(e=f,f=null,e.id=e.id||this.id,e.then(function(e){r.exp(e)}))},C.prototype.complete=function(){delete a[this.id],N.prototype.complete.apply(this,arguments)},C.prototype.execute=function(){var e=this;typeof this.body=="object"?this.exp(this.body):typeof this.body=="function"&&this.body.apply(window,[function(t){e.exp(t)}])},C.prototype.exp=function(e){this.complete(this.exports=C.exports[this.id]=e||{})},k.prototype=new T,k.prototype.start=function(){function t(){var t=[];e.collectResults&&(t[0]={});for(var n=0,r;r=e.deps[n];n++){if(!r.completed)return;r.results.length>0&&(e.collectResults?r instanceof L?y(t[0],r.results[0]):x(t[0],r.id,r.results[0]):t=t.concat(r.results))}e.complete.apply(e,t)}var e=this;for(var n=0,r;r=this.deps[n];n++)r.then(t);return this},L.prototype=new T,L.prototype.start=function(){var e=this,t=0,n=[];return e.collectResults&&(n[0]={}),function r(){var i=e.deps[t++];i?i.then(function(t){i.results.length>0&&(e.collectResults?i instanceof L?y(n[0],i.results[0]):x(n[0],i.id,i.results[0]):n.push(i.results[0])),r()}):e.complete.apply(e,n)}(),this},P.amd={};var F=function(e){return e(H,M,F,define)};F.Script=N,F.Module=C,F.Collection=k,F.Sequence=L,F.Dependency=T,F.noConflict=I,e.loadrunner=F,e.using=H,e.provide=M,e.define=P,H.path="",H.matchers=[],H.matchers.add=function(e,t){this.unshift([e,t])},H.matchers.add(/(^script!|\.js$)/,function(e){var t=new N(e.replace(/^\$/,H.path.replace(/\/$/,"")+"/").replace(/^script!/,""),!1);return t.id=e,t}),H.matchers.add(/^[a-zA-Z0-9_\-\/]+$/,function(e){return new C(e)}),H.bundles=[],s&&(H.path=s.getAttribute("data-path")||s.src.split(/loadrunner\.js/)[0]||"",(main=s.getAttribute("data-main"))&&H.apply(e,main.split(/\s*,\s*/)).then(function(){}))})(this,document);window.__twttrlr = loadrunner.noConflict();__twttrlr(function(using, provide, loadrunner, define) {provide("util/util",function(e){function t(e){var t=1,n,r;for(;n=arguments[t];t++)for(r in n)if(!n.hasOwnProperty||n.hasOwnProperty(r))e[r]=n[r];return e}function n(e){for(var t in e)e.hasOwnProperty(t)&&(l(e[t])&&(n(e[t]),c(e[t])&&delete e[t]),(e[t]===undefined||e[t]===null||e[t]==="")&&delete e[t]);return e}function r(e,t){var n=0,r;for(;r=e[n];n++)if(t==r)return n;return-1}function i(e,t){if(!e)return null;if(e.filter)return e.filter.apply(e,[t]);if(!t)return e;var n=[],r=0,i;for(;i=e[r];r++)t(i)&&n.push(i);return n}function s(e,t){if(!e)return null;if(e.map)return e.map.apply(e,[t]);if(!t)return e;var n=[],r=0,i;for(;i=e[r];r++)n.push(t(i));return n}function o(e){return e&&e.replace(/(^\s+|\s+$)/g,"")}function u(e){return{}.toString.call(e).match(/\s([a-zA-Z]+)/)[1].toLowerCase()}function a(e){return e&&String(e).toLowerCase().indexOf("[native code]")>-1}function f(e,t){if(e.contains)return e.contains(t);var n=t.parentNode;while(n){if(n===e)return!0;n=n.parentNode}return!1}function l(e){return e===Object(e)}function c(e){if(!l(e))return!1;if(Object.keys)return!Object.keys(e).length;for(var t in e)if(e.hasOwnProperty(t))return!1;return!0}e({aug:t,compact:n,containsElement:f,filter:i,map:s,trim:o,indexOf:r,isNative:a,isObject:l,isEmptyObject:c,toType:u})});
provide("util/events",function(e){using("util/util",function(t){function r(){this.completed=!1,this.callbacks=[]}var n={bind:function(e,t){return this._handlers=this._handlers||{},this._handlers[e]=this._handlers[e]||[],this._handlers[e].push(t)},unbind:function(e,n){if(!this._handlers[e])return;if(n){var r=t.indexOf(this._handlers[e],n);r>=0&&this._handlers[e].splice(r,1)}else this._handlers[e]=[]},trigger:function(e,t){var n=this._handlers&&this._handlers[e];t.type=e;if(n)for(var r=0,i;i=n[r];r++)i.call(this,t)}};r.prototype.addCallback=function(e){this.completed?e.apply(this,this.results):this.callbacks.push(e)},r.prototype.complete=function(){this.results=makeArray(arguments),this.completed=!0;for(var e=0,t;t=this.callbacks[e];e++)t.apply(this,this.results)},e({Emitter:n,Promise:r})})});
provide("util/querystring",function(e){function t(e){return encodeURIComponent(e).replace(/\+/g,"%2B")}function n(e){return decodeURIComponent(e)}function r(e){var n=[],r;for(r in e)e[r]!==null&&typeof e[r]!="undefined"&&n.push(t(r)+"="+t(e[r]));return n.sort().join("&")}function i(e){var t={},r,i,s,o;if(e){r=e.split("&");for(o=0;s=r[o];o++)i=s.split("="),i.length==2&&(t[n(i[0])]=n(i[1]))}return t}function s(e,t){var n=r(t);return n.length>0?e.indexOf("?")>=0?e+"&"+r(t):e+"?"+r(t):e}function o(e){var t=e&&e.split("?");return t.length==2?i(t[1]):{}}e({url:s,decodeURL:o,decode:i,encode:r,encodePart:t,decodePart:n})});
provide("util/twitter",function(e){using("util/querystring",function(t){function o(e){return typeof e=="string"&&n.test(e)&&RegExp.$1.length<=20}function u(e){if(o(e))return RegExp.$1}function a(e){var n=t.decodeURL(e);n.screen_name=u(e);if(n.screen_name)return t.url("https://twitter.com/intent/user",n)}function f(e){return typeof e=="string"&&s.test(e)}function l(e,t){t=t===undefined?!0:t;if(f(e))return(t?"#":"")+RegExp.$1}function c(e){return typeof e=="string"&&r.test(e)}function h(e){return c(e)&&RegExp.$1}function p(e){return i.test(e)}var n=/(?:^|(?:https?\:)?\/\/(?:www\.)?twitter\.com(?:\:\d+)?(?:\/intent\/(?:follow|user)\/?\?screen_name=|(?:\/#!)?\/))@?([\w]+)(?:\?|&|$)/i,r=/(?:^|(?:https?\:)?\/\/(?:www\.)?twitter\.com(?:\:\d+)?\/(?:#!\/)?[\w_]+\/status(?:es)?\/)(\d+)/i,i=/^http(s?):\/\/((www\.)?)twitter\.com\//,s=/^#?([^.,<>!\s\/#\-\(\)\'\"]+)$/;e({isHashTag:f,hashTag:l,isScreenName:o,screenName:u,isStatus:c,status:h,intentForProfileURL:a,isTwitterURL:p,regexen:{profile:n}})})});
provide("util/uri",function(e){using("util/querystring","util/util","util/twitter",function(t,n,r){function i(e,t){var n,r;return t=t||location,/^https?:\/\//.test(e)?e:/^\/\//.test(e)?t.protocol+e:(n=t.host+(t.port.length?":"+t.port:""),e.indexOf("/")!==0&&(r=t.pathname.split("/"),r.pop(),r.push(e),e="/"+r.join("/")),[t.protocol,"//",n,e].join(""))}function s(){var e=document.getElementsByTagName("link"),t=0,n;for(;n=e[t];t++)if(n.rel=="canonical")return i(n.href)}function o(){var e=document.getElementsByTagName("a"),t=document.getElementsByTagName("link"),n=[e,t],i,s,o=0,u=0,a=/\bme\b/,f;for(;i=n[o];o++)for(u=0;s=i[u];u++)if(a.test(s.rel)&&(f=r.screenName(s.href)))return f}e({absolutize:i,getCanonicalURL:s,getScreenNameFromPage:o})})});
provide("util/typevalidator",function(e){using("util/util",function(t){function n(e){return e!==undefined&&e!==null&&e!==""}function r(e){return s(e)&&e%1===0}function i(e){return s(e)&&!r(e)}function s(e){return n(e)&&!isNaN(e)}function o(e){return n(e)&&t.toType(e)=="array"}function u(e){if(!n(e))return!1;switch(e){case"on":case"ON":case"true":case"TRUE":return!0;case"off":case"OFF":case"false":case"FALSE":return!1;default:return!!e}}function a(e){if(s(e))return e}function f(e){if(i(e))return e}function l(e){if(r(e))return e}e({hasValue:n,isInt:r,isFloat:i,isNumber:s,isArray:o,asInt:l,asFloat:f,asNumber:a,asBoolean:u})})});
provide("tfw/util/globals",function(e){using("util/typevalidator",function(t){function r(){var e=document.getElementsByTagName("meta"),t,r,i=0;n={};for(;t=e[i];i++){if(!/^twitter:/.test(t.name))continue;r=t.name.replace(/^twitter:/,""),n[r]=t.content}}function i(e){return n[e]}function s(e){return t.asBoolean(e)&&(n.dnt=!0),t.asBoolean(n.dnt)}var n;r(),e({init:r,val:i,dnt:s})})});
provide("util/logger",function(e){function n(e){window[t]&&window[t].log&&window[t].log(e)}function r(e){window[t]&&window[t].warn&&window[t].warn(e)}function i(e){window[t]&&window[t].error&&window[t].error(e)}var t=["con","sole"].join("");e({info:n,warn:r,error:i})});
provide("util/domready",function(e){function l(){t=1;for(var e=0,r=n.length;e<r;e++)n[e]()}var t=0,n=[],r,i,s=!1,o=document.createElement("a"),u="DOMContentLoaded",a="addEventListener",f="onreadystatechange";/^loade|c/.test(document.readyState)&&(t=1),document[a]&&document[a](u,i=function(){document.removeEventListener(u,i,s),l()},s),o.doScroll&&document.attachEvent(f,r=function(){/^c/.test(document.readyState)&&(document.detachEvent(f,r),l())});var c=o.doScroll?function(e){self!=top?t?e():n.push(e):!function(){try{o.doScroll("left")}catch(t){return setTimeout(function(){c(e)},50)}e()}()}:function(e){t?e():n.push(e)};e(c)});
provide("util/env",function(e){using("util/domready","util/typevalidator","util/logger","tfw/util/globals",function(t,n,r,i){function f(){return window.devicePixelRatio?window.devicePixelRatio>=1.5:window.matchMedia?window.matchMedia("only screen and (min-resolution: 144dpi)").matches:!1}function l(){return/MSIE \d/.test(s)}function c(){return/MSIE 6/.test(s)}function h(){return/MSIE 7/.test(s)}function p(){return o}function d(){return"ontouchstart"in window||/Opera Mini/.test(s)||navigator.msMaxTouchPoints>0}function v(){var e=document.body.style;return e.transition!==undefined||e.webkitTransition!==undefined||e.mozTransition!==undefined||e.oTransition!==undefined||e.msTransition!==undefined}var s=window.navigator.userAgent,o=!1,u=!1,a="twitter-csp-test";window.twttr=window.twttr||{},twttr.verifyCSP=function(e){var t=document.getElementById(a);u=!0,o=!!e,t&&t.parentNode.removeChild(t)},t(function(){var e;if(c()||h())return o=!1;if(n.asBoolean(i.val("widgets:csp")))return o=!0;e=document.createElement("script"),e.id=a,e.text="twttr.verifyCSP(false);",document.body.appendChild(e),window.setTimeout(function(){if(u)return;r.warn('TWITTER: Content Security Policy restrictions may be applied to your site. Add <meta name="twitter:widgets:csp" content="on"> to supress this warning.'),r.warn("TWITTER: Please note: Not all embedded timeline and embedded Tweet functionality is supported when CSP is applied.")},5e3)}),e({retina:f,anyIE:l,ie6:c,ie7:h,cspEnabled:p,touch:d,cssTransitions:v})})});
provide("dom/delegate",function(e){using("util/env",function(t){function i(e){var t=e.getAttribute("data-twitter-event-id");return t?t:(e.setAttribute("data-twitter-event-id",++r),r)}function s(e,t,n){var r=0,i=e&&e.length||0;for(r=0;r<i;r++)e[r].call(t,n)}function o(e,t,n){var r=n||e.target||e.srcElement,i=r.className.split(" "),u=0,a,f=i.length;for(;u<f;u++)s(t["."+i[u]],r,e);s(t[r.tagName],r,e);if(e.cease)return;r!==this&&o.call(this,e,t,r.parentElement||r.parentNode)}function u(e,t,n){if(e.addEventListener){e.addEventListener(t,function(r){o.call(e,r,n[t])},!1);return}e.attachEvent&&e.attachEvent("on"+t,function(){o.call(e,e.ownerDocument.parentWindow.event,n[t])})}function a(e,t,r,s){var o=i(e);n[o]=n[o]||{},n[o][t]||(n[o][t]={},u(e,t,n[o])),n[o][t][r]=n[o][t][r]||[],n[o][t][r].push(s)}function f(e,t,n){e.addEventListener?e.addEventListener(t,n,!1):e.attachEvent("on"+t,function(){n(window.event)})}function l(e,t,r){var s=i(t),u=n[s]&&n[s];o.call(t,{target:r},u[e])}function c(e){return p(e),h(e),!1}function h(e){e&&e.preventDefault?e.preventDefault():e.returnValue=!1}function p(e){e&&(e.cease=!0)&&e.stopPropagation?e.stopPropagation():e.cancelBubble=!0}var n={},r=-1;e({stop:c,stopPropagation:p,preventDefault:h,delegate:a,on:f,simulate:l})})});
provide("tfw/util/article",function(e){using("dom/delegate","tfw/util/globals","util/uri",function(t,n,r){function s(){i=r.getCanonicalURL()||""+document.location;if(!window.top.postMessage)return;if(window==window.top){t.on(window,"message",function(e){var t;if(e.data&&e.data[0]!="{")return;try{t=JSON.parse(e.data)}catch(r){}t&&t.name=="twttr:private:requestArticleUrl"&&e.source.postMessage(JSON.stringify({name:"twttr:private:provideArticleUrl",data:{url:i,dnt:n.dnt()}}),"*")});return}t.on(window,"message",function(e){var t;if(e.data&&e.data[0]!="{")return;try{t=JSON.parse(e.data)}catch(r){}t&&t.name=="twttr:private:provideArticleUrl"&&(i=t.data&&t.data.url,n.dnt(t.data.dnt))}),window.top.postMessage(JSON.stringify({name:"twttr:private:requestArticleUrl"}),"*")}var i;s(),e({url:function(){return i}})})});
provide("util/iframe",function(e){e(function(e){var t=(e.replace&&e.replace.ownerDocument||document).createElement("div"),n,r,i;t.innerHTML="<iframe allowtransparency='true' frameBorder='0' scrolling='no'></iframe>",n=t.firstChild,n.src=e.url,n.className=e.className||"";if(e.css)for(r in e.css)e.css.hasOwnProperty(r)&&(n.style[r]=e.css[r]);if(e.attributes)for(i in e.attributes)e.attributes.hasOwnProperty(i)&&n.setAttribute(i,e.attributes[i]);return e.replace?e.replace.parentNode.replaceChild(n,e.replace):e.insertTarget&&e.insertTarget.appendChild(n),n})});
provide("dom/get",function(e){using("util/util",function(t){function n(e,n,r,i){var s,o,u=[],a,f,l,c,h,p;n=n||document;if(t.isNative(n.getElementsByClassName))return u=t.filter(n.getElementsByClassName(e),function(e){return!r||e.tagName.toLowerCase()==r.toLowerCase()}),[].slice.call(u,0,i||u.length);a=e.split(" "),c=a.length,s=n.getElementsByTagName(r||"*"),p=s.length;for(l=0;l<c&&p>0;l++){u=[],f=a[l];for(h=0;h<p;h++){o=s[h],~t.indexOf(o.className.split(" "),f)&&u.push(o);if(l+1==c&&u.length===i)break}s=u,p=s.length}return u}function r(e,t,r){return n(e,t,r,1)[0]}function i(e,n,r){var s=n&&n.parentNode,o;if(!s||s===r)return;return s.tagName==e?s:(o=s.className.split(" "),0===e.indexOf(".")&&~t.indexOf(o,e.slice(1))?s:i(e,s,r))}e({all:n,one:r,ancestor:i})})});
provide("tfw/widget/base",function(e){using("util/util","util/domready","dom/get","tfw/util/globals","util/querystring","util/iframe","util/typevalidator",function(t,n,r,i,s,o,u){function p(e){var t;if(!e)return;e.ownerDocument?(this.srcEl=e,this.classAttr=e.className.split(" ")):(this.srcOb=e,this.classAttr=[]),t=this.params(),this.id=v(),this.setLanguage(),this.related=t.related||this.dataAttr("related"),this.partner=t.partner||this.dataAttr("partner")||i.val("partner"),this.dnt=t.dnt||this.dataAttr("dnt")||i.dnt()||"",this.styleAttr=[],this.targetEl=e.targetEl}function d(){var e=0,t;for(;t=c[e];e++)t.call()}function v(){return this.srcEl&&this.srcEl.id||"twitter-widget-"+a++}function m(e){if(!e)return;return e.lang?e.lang:m(e.parentNode)}var a=0,f,l={list:[],byId:{}},c=[],h={ar:{"%{followers_count} followers":"عدد المتابعين %{followers_count}","100K+":"+100 ألف","10k unit":"10 آلاف وحدة",Follow:"تابِع","Follow %{screen_name}":"تابِع %{screen_name}",K:"ألف",M:"مليون",Tweet:"غرِّد","Tweet %{hashtag}":"غرِّد %{hashtag}","Tweet to %{name}":"غرِّد لـ %{name}","Twitter Stream":"خطّ تويتر الزمنيّ"},da:{"%{followers_count} followers":"%{followers_count} følgere","10k unit":"10k enhed",Follow:"Følg","Follow %{screen_name}":"Følg %{screen_name}","Tweet to %{name}":"Tweet til %{name}","Twitter Stream":"Twitter-strøm"},de:{"%{followers_count} followers":"%{followers_count} Follower","100K+":"100Tsd+","10k unit":"10tsd-Einheit",Follow:"Folgen","Follow %{screen_name}":"%{screen_name} folgen",K:"Tsd",Tweet:"Twittern","Tweet to %{name}":"Tweet an %{name}"},es:{"%{followers_count} followers":"%{followers_count} seguidores","10k unit":"10k unidad",Follow:"Seguir","Follow %{screen_name}":"Seguir a %{screen_name}",Tweet:"Twittear","Tweet %{hashtag}":"Twittear %{hashtag}","Tweet to %{name}":"Twittear a %{name}","Twitter Stream":"Cronología de Twitter"},fa:{"%{followers_count} followers":"%{followers_count} دنبال‌کننده","100K+":">۱۰۰هزار","10k unit":"۱۰هزار واحد",Follow:"دنبال کردن","Follow %{screen_name}":"دنبال کردن %{screen_name}",K:"هزار",M:"میلیون",Tweet:"توییت","Tweet %{hashtag}":"توییت کردن %{hashtag}","Tweet to %{name}":"به %{name} توییت کنید","Twitter Stream":"جریان توییت‌ها"},fi:{"%{followers_count} followers":"%{followers_count} seuraajaa","100K+":"100 000+","10k unit":"10 000 yksikköä",Follow:"Seuraa","Follow %{screen_name}":"Seuraa käyttäjää %{screen_name}",K:"tuhatta",M:"milj.",Tweet:"Twiittaa","Tweet %{hashtag}":"Twiittaa %{hashtag}","Tweet to %{name}":"Twiittaa käyttäjälle %{name}","Twitter Stream":"Twitter-virta"},fil:{"%{followers_count} followers":"%{followers_count} mga tagasunod","10k unit":"10k yunit",Follow:"Sundan","Follow %{screen_name}":"Sundan si %{screen_name}",Tweet:"I-tweet","Tweet %{hashtag}":"I-tweet ang %{hashtag}","Tweet to %{name}":"Mag-Tweet kay %{name}","Twitter Stream":"Stream ng Twitter"},fr:{"%{followers_count} followers":"%{followers_count} abonnés","10k unit":"unité de 10k",Follow:"Suivre","Follow %{screen_name}":"Suivre %{screen_name}",Tweet:"Tweeter","Tweet %{hashtag}":"Tweeter %{hashtag}","Tweet to %{name}":"Tweeter à %{name}","Twitter Stream":"Flux Twitter"},he:{"%{followers_count} followers":"%{followers_count} עוקבים","100K+":"מאות אלפים","10k unit":"עשרות אלפים",Follow:"מעקב","Follow %{screen_name}":"לעקוב אחר %{screen_name}",K:"אלף",M:"מיליון",Tweet:"ציוץ","Tweet %{hashtag}":"צייצו %{hashtag}","Tweet to %{name}":"ציוץ אל %{name}","Twitter Stream":"התזרים של טוויטר"},hi:{"%{followers_count} followers":"%{followers_count} फ़ॉलोअर्स","100K+":"1 लाख+","10k unit":"10 हजार इकाईयां",Follow:"फ़ॉलो","Follow %{screen_name}":"%{screen_name} को फ़ॉलो करें",K:"हजार",M:"मिलियन",Tweet:"ट्वीट","Tweet %{hashtag}":"ट्वीट %{hashtag}","Tweet to %{name}":"%{name} को ट्वीट करें","Twitter Stream":"ट्विटर स्ट्रीम"},hu:{"%{followers_count} followers":"%{followers_count} követő","100K+":"100E+","10k unit":"10E+",Follow:"Követés","Follow %{screen_name}":"%{screen_name} követése",K:"E","Tweet %{hashtag}":"%{hashtag} tweetelése","Tweet to %{name}":"Tweet küldése neki: %{name}","Twitter Stream":"Twitter Hírfolyam"},id:{"%{followers_count} followers":"%{followers_count} pengikut","100K+":"100 ribu+","10k unit":"10 ribu unit",Follow:"Ikuti","Follow %{screen_name}":"Ikuti %{screen_name}",K:"&nbsp;ribu",M:"&nbsp;juta","Tweet to %{name}":"Tweet ke %{name}","Twitter Stream":"Aliran Twitter"},it:{"%{followers_count} followers":"%{followers_count} follower","10k unit":"10k unità",Follow:"Segui","Follow %{screen_name}":"Segui %{screen_name}","Tweet %{hashtag}":"Twitta %{hashtag}","Tweet to %{name}":"Twitta a %{name}"},ja:{"%{followers_count} followers":"%{followers_count}人のフォロワー","100K+":"100K以上","10k unit":"万",Follow:"フォローする","Follow %{screen_name}":"%{screen_name}さんをフォロー",Tweet:"ツイート","Tweet %{hashtag}":"%{hashtag} をツイートする","Tweet to %{name}":"%{name}さんへツイートする","Twitter Stream":"Twitterストリーム"},ko:{"%{followers_count} followers":"%{followers_count}명의 팔로워","100K+":"100만 이상","10k unit":"만 단위",Follow:"팔로우","Follow %{screen_name}":"%{screen_name} 님 팔로우하기",K:"천",M:"백만",Tweet:"트윗","Tweet %{hashtag}":"%{hashtag} 관련 트윗하기","Tweet to %{name}":"%{name}님에게 트윗하기","Twitter Stream":"트위터 스트림"},msa:{"%{followers_count} followers":"%{followers_count} pengikut","100K+":"100 ribu+","10k unit":"10 ribu unit",Follow:"Ikut","Follow %{screen_name}":"Ikut %{screen_name}",K:"ribu",M:"juta","Tweet to %{name}":"Tweet kepada %{name}","Twitter Stream":"Strim Twitter"},nl:{"%{followers_count} followers":"%{followers_count} volgers","100K+":"100k+","10k unit":"10k-eenheid",Follow:"Volgen","Follow %{screen_name}":"%{screen_name} volgen",K:"k",M:" mln.",Tweet:"Tweeten","Tweet %{hashtag}":"%{hashtag} tweeten","Tweet to %{name}":"Tweeten naar %{name}"},no:{"%{followers_count} followers":"%{followers_count} følgere","100K+":"100 K+","10k unit":"10 K-enhet",Follow:"Følg","Follow %{screen_name}":"Følg %{screen_name}","Tweet to %{name}":"Send en tweet til %{name}","Twitter Stream":"Twitter-strøm"},pl:{"%{followers_count} followers":"%{followers_count} obserwujących","100K+":"100 tys.+","10k unit":"10 tys.",Follow:"Obserwuj","Follow %{screen_name}":"Obserwuj %{screen_name}",K:"tys.",M:"mln",Tweet:"Tweetnij","Tweet %{hashtag}":"Tweetnij %{hashtag}","Tweet to %{name}":"Tweetnij do %{name}","Twitter Stream":"Strumień Twittera"},pt:{"%{followers_count} followers":"%{followers_count} seguidores","100K+":"+100 mil","10k unit":"10 mil unidades",Follow:"Seguir","Follow %{screen_name}":"Seguir %{screen_name}",K:"Mil",Tweet:"Tweetar","Tweet %{hashtag}":"Tweetar %{hashtag}","Tweet to %{name}":"Tweetar para %{name}","Twitter Stream":"Transmissões do Twitter"},ru:{"%{followers_count} followers":"Читатели: %{followers_count} ","100K+":"100 тыс.+","10k unit":"блок 10k",Follow:"Читать","Follow %{screen_name}":"Читать %{screen_name}",K:"тыс.",M:"млн.",Tweet:"Твитнуть","Tweet %{hashtag}":"Твитнуть %{hashtag}","Tweet to %{name}":"Твитнуть %{name}","Twitter Stream":"Поток в Твиттере"},sv:{"%{followers_count} followers":"%{followers_count} följare","10k unit":"10k",Follow:"Följ","Follow %{screen_name}":"Följ %{screen_name}",Tweet:"Tweeta","Tweet %{hashtag}":"Tweeta %{hashtag}","Tweet to %{name}":"Tweeta till %{name}","Twitter Stream":"Twitterflöde"},th:{"%{followers_count} followers":"%{followers_count} ผู้ติดตาม","100K+":"100พัน+","10k unit":"หน่วย 10พัน",Follow:"ติดตาม","Follow %{screen_name}":"ติดตาม %{screen_name}",K:"พัน",M:"ล้าน",Tweet:"ทวีต","Tweet %{hashtag}":"ทวีต %{hashtag}","Tweet to %{name}":"ทวีตถึง %{name}","Twitter Stream":"ทวิตเตอร์สตรีม"},tr:{"%{followers_count} followers":"%{followers_count} takipçi","100K+":"+100 bin","10k unit":"10 bin birim",Follow:"Takip et","Follow %{screen_name}":"Takip et: %{screen_name}",K:"bin",M:"milyon",Tweet:"Tweetle","Tweet %{hashtag}":"Tweetle: %{hashtag}","Tweet to %{name}":"Tweetle: %{name}","Twitter Stream":"Twitter Akışı"},ur:{"%{followers_count} followers":"%{followers_count} فالورز","100K+":"ایک لاکھ سے زیادہ","10k unit":"دس ہزار یونٹ",Follow:"فالو کریں","Follow %{screen_name}":"%{screen_name} کو فالو کریں",K:"ہزار",M:"ملین",Tweet:"ٹویٹ کریں","Tweet %{hashtag}":"%{hashtag} ٹویٹ کریں","Tweet to %{name}":"%{name} کو ٹویٹ کریں","Twitter Stream":"ٹوئٹر سٹریم"},"zh-cn":{"%{followers_count} followers":"%{followers_count} 关注者","100K+":"10万+","10k unit":"1万单元",Follow:"关注","Follow %{screen_name}":"关注 %{screen_name}",K:"千",M:"百万",Tweet:"发推","Tweet %{hashtag}":"以 %{hashtag} 发推","Tweet to %{name}":"发推给 %{name}","Twitter Stream":"Twitter 信息流"},"zh-tw":{"%{followers_count} followers":"%{followers_count} 位跟隨者","100K+":"超過十萬","10k unit":"1萬 單位",Follow:"跟隨","Follow %{screen_name}":"跟隨 %{screen_name}",K:"千",M:"百萬",Tweet:"推文","Tweet %{hashtag}":"推文%{hashtag}","Tweet to %{name}":"推文給%{name}","Twitter Stream":"Twitter 資訊流"}};t.aug(p.prototype,{setLanguage:function(e){var t;e||(e=this.params().lang||this.dataAttr("lang")||m(this.srcEl)),e=e&&e.toLowerCase();if(!e)return this.lang="en";if(h[e])return this.lang=e;t=e.replace(/[\-_].*/,"");if(h[t])return this.lang=t;this.lang="en"},_:function(e,t){var n=this.lang;t=t||{};if(!n||!h.hasOwnProperty(n))n=this.lang="en";return e=h[n]&&h[n][e]||e,this.ringo(e,t,/%\{([\w_]+)\}/g)},ringo:function(e,t,n){return n=n||/\{\{([\w_]+)\}\}/g,e.replace(n,function(e,n){return t[n]!==undefined?t[n]:e})},add:function(e){l.list.push(this),l.byId[this.id]=e},create:function(e,t,n){return n["data-twttr-rendered"]=!0,o({url:e,css:t,className:this.classAttr.join(" "),id:this.id,attributes:n,replace:this.srcEl,insertTarget:this.targetEl})},params:function(){var e,t;return this.srcOb?t=this.srcOb:(e=this.srcEl&&this.srcEl.href&&this.srcEl.href.split("?")[1],t=e?s.decode(e):{}),this.params=function(){return t},t},dataAttr:function(e){return this.srcEl&&this.srcEl.getAttribute("data-"+e)},attr:function(e){return this.srcEl&&this.srcEl.getAttribute(e)},styles:{base:[["font","normal normal normal 11px/18px 'Helvetica Neue', Arial, sans-serif"],["margin","0"],["padding","0"],["whiteSpace","nowrap"]],button:[["fontWeight","bold"],["textShadow","0 1px 0 rgba(255,255,255,.5)"]],large:[["fontSize","13px"],["lineHeight","26px"]],vbubble:[["fontSize","16px"]]},width:function(){throw new Error(name+" not implemented")},height:function(){return this.size=="m"?20:28},minWidth:function(){},maxWidth:function(){},minHeight:function(){},maxHeight:function(){},dimensions:function(){function e(e){switch(typeof e){case"string":return e;case"undefined":return;default:return e+"px"}}var t,n={width:this.width(),height:this.height()};this.minWidth()&&(n["min-width"]=this.minWidth()),this.maxWidth()&&(n["max-width"]=this.maxWidth()),this.minHeight()&&(n["min-height"]=this.minHeight()),this.maxHeight()&&(n["max-height"]=this.maxHeight());for(t in n)n[t]=e(n[t]);return n},generateId:v}),p.afterLoad=function(e){c.push(e)},p.init=function(e){f=e},p.find=function(e){return e&&l.byId[e]?l.byId[e].element:null},p.embed=function(e){var t=f.widgets,n,i,s=0,o,a,c,h,p;u.isArray(e)||(e=[e||document]);for(;i=e[s];s++)for(a in t)if(t.hasOwnProperty(a)){a.match(/\./)?(c=a.split("."),n=r.all(c[1],i,c[0])):n=i.getElementsByTagName(a);for(h=0;p=n[h];h++){if(p.getAttribute("data-twttr-rendered"))continue;p.setAttribute("data-twttr-rendered","true"),o=new t[a](p),l.list.push(o),l.byId[o.id]=o,o.render(f)}}d()},e(p)})});
provide("tfw/widget/intent",function(e){using("tfw/widget/base","util/util","util/querystring","util/uri",function(t,n,r,i){function h(e){var t=Math.round(l/2-u/2),n=0;f>a&&(n=Math.round(f/2-a/2)),window.open(e,undefined,[o,"width="+u,"height="+a,"left="+t,"top="+n].join(","))}function p(e,t){using("tfw/hub/client",function(n){n.openIntent(e,t)})}function d(e){var t="original_referer="+location.href;return[e,t].join(e.indexOf("?")==-1?"?":"&")}function v(e){var t,r,i,o;e=e||window.event,t=e.target||e.srcElement;if(e.altKey||e.metaKey||e.shiftKey)return;while(t){if(~n.indexOf(["A","AREA"],t.nodeName))break;t=t.parentNode}t&&t.href&&(r=t.href.match(s),r&&(o=d(t.href),o=o.replace(/^http[:]/,"https:"),o=o.replace(/^\/\//,"https://"),m(o,t),e.returnValue=!1,e.preventDefault&&e.preventDefault()))}function m(e,t){if(twttr.events.hub&&t){var n=new g(c.generateId(),t);c.add(n),p(e,t),twttr.events.trigger("click",{target:t,region:"intent",type:"click",data:{}})}else h(e)}function g(e,t){this.id=e,this.element=this.srcEl=t}function y(e){this.srcEl=[],this.element=e}var s=/twitter\.com(\:\d{2,4})?\/intent\/(\w+)/,o="scrollbars=yes,resizable=yes,toolbar=no,location=yes",u=550,a=520,f=screen.height,l=screen.width,c;y.prototype=new t,n.aug(y.prototype,{render:function(e){c=this,window.__twitterIntentHandler||(document.addEventListener?document.addEventListener("click",v,!1):document.attachEvent&&document.attachEvent("onclick",v),window.__twitterIntentHandler=!0)}}),y.open=m,e(y)})});
provide("dom/classname",function(e){function t(e,t){e.classList?e.classList.add(t):s(t).test(e.className)||(e.className+=" "+t)}function n(e,t){e.classList?e.classList.remove(t):e.className=e.className.replace(s(t)," ")}function r(e,r,o){e.classList&&i(e,r)?(n(e,r),t(e,o)):e.className=e.className.replace(s(r),o)}function i(e,t){return e.classList?e.classList.contains(t):s(t).test(e.className)}function s(e){return new RegExp("\\b"+e+"\\b","g")}e({add:t,remove:n,replace:r,present:i})});
provide("util/throttle",function(e){function t(e,t,n){function o(){var n=+(new Date);window.clearTimeout(s);if(n-i>t){i=n,e.call(r);return}s=window.setTimeout(o,t)}var r=n||this,i=0,s;return o}e(t)});
provide("util/insert",function(e){e(function(e,t){if(t){if(!t.parentNode)return t;t.parentNode.replaceChild(e,t),delete t}else document.body.insertBefore(e,document.body.firstChild);return e})});
provide("util/css",function(e){using("util/util",function(t){e({sanitize:function(e,n,r){var i=/^[\w ,%\/"'\-_#]+$/,s=e&&t.map(e.split(";"),function(e){return t.map(e.split(":").slice(0,2),function(e){return t.trim(e)})}),o=0,u,a=[],f=r?"!important":"";n=n||/^(font|text\-|letter\-|color|line\-)[\w\-]*$/;for(;s&&(u=s[o]);o++)u[0].match(n)&&u[1].match(i)&&a.push(u.join(":")+f);return a.join(";")}})})});
provide("tfw/util/params",function(e){using("util/querystring","util/twitter",function(t,n){e(function(e,r){return function(i){var s,o="data-tw-params",u,a=i.innerHTML;if(!i)return;if(!n.isTwitterURL(i.href))return;if(i.getAttribute(o))return;i.setAttribute(o,!0);if(typeof r=="function"){s=r.call(this,i);for(u in s)s.hasOwnProperty(u)&&(e[u]=s[u])}i.href=t.url(i.href,e),i.innerHTML=a}})})});
provide("$xd/json2.js", function(exports) {window.JSON||(window.JSON={}),function(){function f(e){return e<10?"0"+e:e}function quote(e){return escapable.lastIndex=0,escapable.test(e)?'"'+e.replace(escapable,function(e){var t=meta[e];return typeof t=="string"?t:"\\u"+("0000"+e.charCodeAt(0).toString(16)).slice(-4)})+'"':'"'+e+'"'}function str(e,t){var n,r,i,s,o=gap,u,a=t[e];a&&typeof a=="object"&&typeof a.toJSON=="function"&&(a=a.toJSON(e)),typeof rep=="function"&&(a=rep.call(t,e,a));switch(typeof a){case"string":return quote(a);case"number":return isFinite(a)?String(a):"null";case"boolean":case"null":return String(a);case"object":if(!a)return"null";gap+=indent,u=[];if(Object.prototype.toString.apply(a)==="[object Array]"){s=a.length;for(n=0;n<s;n+=1)u[n]=str(n,a)||"null";return i=u.length===0?"[]":gap?"[\n"+gap+u.join(",\n"+gap)+"\n"+o+"]":"["+u.join(",")+"]",gap=o,i}if(rep&&typeof rep=="object"){s=rep.length;for(n=0;n<s;n+=1)r=rep[n],typeof r=="string"&&(i=str(r,a),i&&u.push(quote(r)+(gap?": ":":")+i))}else for(r in a)Object.hasOwnProperty.call(a,r)&&(i=str(r,a),i&&u.push(quote(r)+(gap?": ":":")+i));return i=u.length===0?"{}":gap?"{\n"+gap+u.join(",\n"+gap)+"\n"+o+"}":"{"+u.join(",")+"}",gap=o,i}}typeof Date.prototype.toJSON!="function"&&(Date.prototype.toJSON=function(e){return isFinite(this.valueOf())?this.getUTCFullYear()+"-"+f(this.getUTCMonth()+1)+"-"+f(this.getUTCDate())+"T"+f(this.getUTCHours())+":"+f(this.getUTCMinutes())+":"+f(this.getUTCSeconds())+"Z":null},String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(e){return this.valueOf()});var cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={"\b":"\\b","	":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"},rep;typeof JSON.stringify!="function"&&(JSON.stringify=function(e,t,n){var r;gap="",indent="";if(typeof n=="number")for(r=0;r<n;r+=1)indent+=" ";else typeof n=="string"&&(indent=n);rep=t;if(!t||typeof t=="function"||typeof t=="object"&&typeof t.length=="number")return str("",{"":e});throw new Error("JSON.stringify")}),typeof JSON.parse!="function"&&(JSON.parse=function(text,reviver){function walk(e,t){var n,r,i=e[t];if(i&&typeof i=="object")for(n in i)Object.hasOwnProperty.call(i,n)&&(r=walk(i,n),r!==undefined?i[n]=r:delete i[n]);return reviver.call(e,t,i)}var j;cx.lastIndex=0,cx.test(text)&&(text=text.replace(cx,function(e){return"\\u"+("0000"+e.charCodeAt(0).toString(16)).slice(-4)}));if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,"@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]").replace(/(?:^|:|,)(?:\s*\[)+/g,"")))return j=eval("("+text+")"),typeof reviver=="function"?walk({"":j},""):j;throw new SyntaxError("JSON.parse")})}();exports();loadrunner.Script.loaded.push("$xd/json2.js")});
provide("util/params",function(e){using("util/querystring",function(t){var n=function(e){var n=e.search.substr(1);return t.decode(n)},r=function(e){var n=e.href,r=n.indexOf("#"),i=r<0?"":n.substring(r+1);return t.decode(i)},i=function(e){var t={},i=n(e),s=r(e);for(var o in i)i.hasOwnProperty(o)&&(t[o]=i[o]);for(var o in s)s.hasOwnProperty(o)&&(t[o]=s[o]);return t};e({combined:i,fromQuery:n,fromFragment:r})})});
provide("tfw/util/env",function(e){using("util/params",function(t){function r(){var e=36e5,r=t.combined(document.location)._;return n!==undefined?n:(n=!1,r&&/^\d+$/.test(r)&&(n=+(new Date)-parseInt(r)<e),n)}var n;e({isDynamicWidget:r})})});
provide("util/decider",function(e){function n(e){var n=t[e]||!1;if(!n)return!1;if(n===!0||n===100)return!0;var r=Math.random()*100,i=n>=r;return t[e]=i,i}var t={force_new_cookie:100,rufous_pixel:100,decider_fixture:12.34};e({isAvailable:n})});
provide("dom/cookie",function(e){using("util/util",function(t){e(function(e,n,r){var i=t.aug({},r);if(arguments.length>1&&String(n)!=="[object Object]"){if(n===null||n===undefined)i.expires=-1;if(typeof i.expires=="number"){var s=i.expires,o=new Date((new Date).getTime()+s*60*1e3);i.expires=o}return n=String(n),document.cookie=[encodeURIComponent(e),"=",i.raw?n:encodeURIComponent(n),i.expires?"; expires="+i.expires.toUTCString():"",i.path?"; path="+i.path:"",i.domain?"; domain="+i.domain:"",i.secure?"; secure":""].join("")}i=n||{};var u,a=i.raw?function(e){return e}:decodeURIComponent;return(u=(new RegExp("(?:^|; )"+encodeURIComponent(e)+"=([^;]*)")).exec(document.cookie))?a(u[1]):null})})});
provide("util/donottrack",function(e){using("dom/cookie",function(t){e(function(e){var n=/\.(gov|mil)(:\d+)?$/i,r=/https?:\/\/([^\/]+).*/i;return e=e||document.referrer,e=r.test(e)&&r.exec(e)[1],t("dnt")?!0:n.test(document.location.host)?!0:e&&n.test(e)?!0:document.navigator?document.navigator["doNotTrack"]==1:navigator?navigator["doNotTrack"]==1||navigator["msDoNotTrack"]==1:!1})})});
provide("tfw/util/guest_cookie",function(e){using("dom/cookie","util/donottrack","util/decider",function(t,n,r){function s(){var e=t(i)||!1;if(!e)return;e.match(/^v3\:/)||o()}function o(){t(i)&&t(i,null,{domain:".twitter.com",path:"/"})}function u(){n()&&o()}var i="pid";e({set:u,destroy:o,forceNewCookie:s,guest_id_cookie:i})})});
provide("dom/sandbox",function(e){using("util/domready","util/env",function(t,n){function i(e,t){var n,r,i;if(e.name){try{i=document.createElement('<iframe name="'+e.name+'"></iframe>')}catch(s){i=document.createElement("iframe"),i.name=e.name}delete e.name}else i=document.createElement("iframe");e.id&&(i.id=e.id,delete e.id);for(n in e)e.hasOwnProperty(n)&&i.setAttribute(n,e[n]);i.allowtransparency="true",i.scrolling="no",i.setAttribute("frameBorder",0),i.setAttribute("allowTransparency",!0);for(r in t||{})t.hasOwnProperty(r)&&(i.style[r]=t[r]);return i}function s(e,t,n,r){var s;this.attrs=t||{},this.styles=n||{},this.appender=r,this.onReady=e,this.sandbox={},s=i(this.attrs,this.styles),s.onreadystatechange=s.onload=this.getCallback(this.onLoad),this.sandbox.frame=s,r?r(s):document.body.appendChild(s)}function o(e,n,r,i){t(function(){new s(e,n,r,i)})}var r=0;window.twttr=window.twttr||{},window.twttr.sandbox||(window.twttr.sandbox={}),s.prototype.getCallback=function(e){var t=this,n=!1;return function(){n||(n=!0,e.call(t))}},s.prototype.registerCallback=function(e){var t="cb"+r++;return window.twttr.sandbox[t]=e,t},s.prototype.onLoad=function(){try{this.sandbox.frame.contentWindow.document}catch(e){this.setDocDomain();return}this.sandbox.win=this.sandbox.frame.contentWindow,this.sandbox.doc=this.sandbox.frame.contentWindow.document,this.writeStandardsDoc(),this.sandbox.body=this.sandbox.frame.contentWindow.document.body,this.onReady(this.sandbox)},s.prototype.setDocDomain=function(){var e,t=this.registerCallback(this.getCallback(this.onLoad));e=["javascript:",'document.write("");',"try { window.parent.document; }","catch (e) {",'document.domain="'+document.domain+'";',"}",'window.parent.twttr.sandbox["'+t+'"]();'].join(""),this.sandbox.frame.parentNode.removeChild(this.sandbox.frame),this.sandbox.frame=null,this.sandbox.frame=i(this.attrs,this.styles),this.sandbox.frame.src=e,this.appender?this.appender(this.sandbox.frame):document.body.appendChild(this.sandbox.frame)},s.prototype.writeStandardsDoc=function(){if(!n.anyIE()||n.cspEnabled())return;var e=["<!DOCTYPE html>","<html>","<head>","<scr","ipt>","try { window.parent.document; }",'catch (e) {document.domain="'+document.domain+'";}',"</scr","ipt>","</head>","<body></body>","</html>"].join("");this.sandbox.doc.write(e),this.sandbox.doc.close()},e(o)})});
provide("tfw/util/tracking",function(e){using("dom/cookie","dom/delegate","dom/sandbox","util/donottrack","tfw/util/guest_cookie","tfw/util/env","util/util","$xd/json2.js",function(t,n,r,i,s,o,u){function E(){y=document.getElementById("rufous-sandbox");if(y){g=y.contentWindow.document,m=g.body;return}r(function(e){y=e.frame,g=e.doc,m=e.doc.body,h=_(),p=D();while(d[0])C.apply(this,d.shift());v&&k()},{id:"rufous-sandbox"},{display:"none"})}function S(e,t,n,r){var i=!u.isObject(e),s=t?!u.isObject(t):!1,o,a;if(i||s)return;if(/Firefox/.test(navigator.userAgent))return;o=A(e),a=O(t,!!n,!!r),N(o,a,!0)}function x(e,n,r,a){var l=f[n],c,h,p=s.guest_id_cookie;if(!l)return;e=e||{},a=!!a,r=!!r,h=e.original_redirect_referrer||document.referrer,a=a||i(h),c=u.aug({},e),r||(T(c,"referrer",h),T(c,"widget",+o.isDynamicWidget()),T(c,"hask",+!!t("k")),T(c,"li",+!!t("twid")),T(c,p,t(p)||"")),a&&(T(c,"dnt",1),H(c)),P(l+"?"+M(c))}function T(e,t,n){var r=a+t;if(!e)return;return e[r]=n,e}function N(e,t,n){var r,i,s,o,a=b+"?";if(!u.isObject(e)||!u.isObject(t))return;s=u.aug({},t,{event_namespace:e}),n?(a+=M({l:B(s)}),P(a)):(r=h.firstChild,r.value=+r.value||+s.dnt,o=B(s),i=g.createElement("input"),i.type="hidden",i.name="l",i.value=o,h.appendChild(i))}function C(e,t,n,r){var i=!u.isObject(e),s=t?!u.isObject(t):!1,o,a;if(i||s)return;if(!m||!h){d.push([e,t,n,r]);return}o=A(e),a=O(t,!!n,!!r),N(o,a)}function k(){var e;if(!h){v=!0;return}if(h.children.length<=1)return;m.appendChild(h),m.appendChild(p),e=L(h,p),n.on(p,"load",function(){window.setTimeout(e,0)}),h.submit(),h=_(),p=D()}function L(e,t){return function(){var n=e.parentNode;if(!n)return;n.removeChild(e),n.removeChild(t)}}function A(e){return u.aug({client:"tfw"},e||{})}function O(e,t,n){var r={_category_:"tfw_client_event"},s,o;return t=!!t,n=!!n,s=u.aug(r,e||{}),o=s.widget_origin||document.referrer,s.format_version=1,s.dnt=n=n||i(o),s.triggered_on=s.triggered_on||+(new Date),t||(s.widget_origin=o),n&&H(s),s}function M(e){var t=[],n,r,i;for(n in e)e.hasOwnProperty(n)&&(r=encodeURIComponent(n),i=encodeURIComponent(e[n]),i=i.replace(/'/g,"%27"),t.push(r+"="+i));return t.join("&")}function _(){var e=g.createElement("form"),t=g.createElement("input"),n=g.createElement("input");return c++,e.action=b,e.method="POST",e.target="rufous-frame-"+c,e.id="rufous-form-"+c,t.type="hidden",t.name="dnt",t.value=0,n.type="hidden",n.name="tfw_redirect",n.value=w,e.appendChild(t),e.appendChild(n),e}function D(){var e,t="rufous-frame-"+c;try{e=g.createElement("<iframe name="+t+">")}catch(n){e=g.createElement("iframe"),e.name=t}return e.id=t,e.style.display="none",e.width=0,e.height=0,e.border=0,e}function P(e){var t=document.createElement("img");t.src=e,t.alt="",t.style.position="absolute",t.style.height="1px",t.style.width="1px",t.style.top="-9999px",t.style.left="-9999px",document.body.appendChild(t)}function H(e){var t;for(t in e)~u.indexOf(l,t)&&delete e[t]}function B(e){var t=Array.prototype.toJSON,n;return delete Array.prototype.toJSON,n=JSON.stringify(e),t&&(Array.prototype.toJSON=t),n}var a="twttr_",f={tweetbutton:"//p.twitter.com/t.gif",followbutton:"//p.twitter.com/f.gif",tweetembed:"//p.twitter.com/e.gif"},l=["hask","li","logged_in","pid","user_id",s.guest_id_cookie,a+"hask",a+"li",a+s.guest_id_cookie],c=0,h,p,d=[],v,m,g,y,b="https://twitter.com/i/jot",w="https://platform.twitter.com/jot.html";s.forceNewCookie(),e({enqueue:C,flush:k,initPostLogging:E,addPixel:S,addLegacyPixel:x,addVar:T})})});
provide("tfw/util/data",function(e){using("util/logger","util/util","util/querystring",function(t,n,r){function c(e,t){return e=={}.toString.call(t).match(/\s([a-zA-Z]+)/)[1].toLowerCase()}function h(e){return function(n){n.error?e.error&&e.error(n):n.headers&&n.headers.status!=200?(e.error&&e.error(n),t.warn(n.headers.message)):e.success&&e.success(n),e.complete&&e.complete(n),p(e)}}function p(e){var t=e.script;t&&(t.onload=t.onreadystatechange=null,t.parentNode&&t.parentNode.removeChild(t),e.script=undefined,t=undefined),e.callbackName&&twttr.tfw.callbacks[e.callbackName]&&delete twttr.tfw.callbacks[e.callbackName]}function d(e){var t={};return e.success&&c("function",e.success)&&(t.success=e.success),e.error&&c("function",e.error)&&(t.error=e.error),e.complete&&c("function",e.complete)&&(t.complete=e.complete),t}function v(e,t,n){var r=e.length,i={},s=0;return function(o){var u,a=[],f=[],l=[],c,h;u=n(o),i[u]=o;if(++s===r){for(c=0;c<r;c++)h=i[e[c]],a.push(h),h.error?l.push(h):f.push(h);t.error&&l.length>0&&t.error(l),t.success&&f.length>0&&t.success(f),t.complete&&t.complete(a)}}}window.twttr=window.twttr||{},twttr.tfw=twttr.tfw||{},twttr.tfw.callbacks=twttr.tfw.callbacks||{};var i="twttr.tfw.callbacks",s=twttr.tfw.callbacks,o="cb",u=0,a=!1,f={},l={userLookup:"//api.twitter.com/1/users/lookup.json",userShow:"//cdn.api.twitter.com/1/users/show.json",status:"//cdn.api.twitter.com/1/statuses/show.json",tweets:"//syndication.twimg.com/tweets.json",count:"//cdn.api.twitter.com/1/urls/count.json",friendship:"//cdn.api.twitter.com/1/friendships/exists.json",timeline:"//cdn.syndication.twimg.com/widgets/timelines/",timelinePoll:"//syndication.twimg.com/widgets/timelines/paged/",timelinePreview:"//syndication.twimg.com/widgets/timelines/preview/"};twttr.widgets&&twttr.widgets.endpoints&&n.aug(l,twttr.widgets.endpoints),f.jsonp=function(e,t,n){var f=n||o+u,l=i+"."+f,c=document.createElement("script"),p={callback:l,suppress_response_codes:!0};s[f]=h(t);if(a||!/^https?\:$/.test(window.location.protocol))e=e.replace(/^\/\//,"https://");c.src=r.url(e,p),c.async="async",document.body.appendChild(c),t.script=c,t.callbackName=f,n||u++},f.config=function(e){if(e.forceSSL===!0||e.forceSSL===!1)a=e.forceSSL},f.user=function(){var e,t={},n,i,s;arguments.length===1?(e=arguments[0].screenName,t=d(arguments[0])):(e=arguments[0],t.success=arguments[1]),n=c("array",e)?l.userLookup:l.userShow,e=c("array",e)?e.join(","):e,i={screen_name:e},s=r.url(n,i),this.jsonp(s,t)},f.userById=function(e){var t,n={},i,s,o;arguments.length===1?(t=e.ids,n=d(e)):(t=e,n.success=arguments[1]),i=c("array",t)?l.userLookup:l.userShow,t=c("array",t)?t.join(","):t,s={user_id:t},o=r.url(i,s),this.jsonp(o,n)},f.status=function(){var e,t={},n,i,s,o;arguments.length===1?(e=arguments[0].id,t=d(arguments[0])):(e=arguments[0],t.success=arguments[1]);if(!c("array",e))n={id:e,include_entities:!0},i=r.url(l.status,n),this.jsonp(i,t);else{s=v(e,t,function(e){return e.error?e.request.split("id=")[1].split("&")[0]:e.id_str});for(o=0;o<e.length;o++)n={id:e[o],include_entities:!0},i=r.url(l.status,n),this.jsonp(i,{success:s,error:s})}},f.tweets=function(e){var t=arguments[0],n=d(t),i={ids:e.ids.join(","),lang:e.lang},s=r.url(l.tweets,i);this.jsonp(s,n)},f.count=function(){var e="",t,n,i={};arguments.length===1?(e=arguments[0].url,i=d(arguments[0])):arguments.length===2&&(e=arguments[0],i.success=arguments[1]),n={url:e},t=r.url(l.count,n),this.jsonp(t,i)},f.friendshipExists=function(e){var t=d(e),n={screen_name_a:e.screenNameA,screen_name_b:e.screenNameB},i=r.url(l.friendship,n);this.jsonp(i,t)},f.timeline=function(e){var t=arguments[0],i=d(t),s,o=9e5,u=Math.floor(+(new Date)/o),a={lang:e.lang,t:u,domain:window.location.host,dnt:e.dnt,override_type:e.overrideType,override_id:e.overrideId,override_name:e.overrideName,override_owner_id:e.overrideOwnerId,override_owner_name:e.overrideOwnerName,with_replies:e.withReplies};n.compact(a),s=r.url(l.timeline+e.id,a),this.jsonp(s,i,"tl_"+e.id+"_"+e.instanceId)},f.timelinePoll=function(e){var t=arguments[0],i=d(t),s={lang:e.lang,since_id:e.sinceId,max_id:e.maxId,domain:window.location.host,dnt:e.dnt,override_type:e.overrideType,override_id:e.overrideId,override_name:e.overrideName,override_owner_id:e.overrideOwnerId,override_owner_name:e.overrideOwnerName,with_replies:e.withReplies},o;n.compact(s),o=r.url(l.timelinePoll+e.id,s),this.jsonp(o,i,"tlPoll_"+e.id+"_"+e.instanceId+"_"+(e.sinceId||e.maxId))},f.timelinePreview=function(e){var t=arguments[0],n=d(t),i=e.params,s=r.url(l.timelinePreview,i);this.jsonp(s,n)},e(f)})});
provide("anim/transition",function(e){function t(e,t){var n;return t=t||window,n=t.requestAnimationFrame||t.webkitRequestAnimationFrame||t.mozRequestAnimationFrame||t.msRequestAnimationFrame||t.oRequestAnimationFrame||function(n){t.setTimeout(function(){e(+(new Date))},1e3/60)},n(e)}function n(e,t){return Math.sin(Math.PI/2*t)*e}function r(e,n,r,i,s){function a(){var u=+(new Date),f=u-o,l=Math.min(f/r,1),c=i?i(n,l):n*l;e(c);if(l==1)return;t(a,s)}var o=+(new Date),u;t(a)}e({animate:r,requestAnimationFrame:t,easeOut:n})});
provide("util/datetime",function(e){using("util/util",function(t){function h(e){return e<10?"0"+e:e}function p(e){function i(e,n){return t&&t[e]&&(e=t[e]),e.replace(/%\{([\w_]+)\}/g,function(e,t){return n[t]!==undefined?n[t]:e})}var t=e&&e.phrases,n=e&&e.months||s,r=e&&e.formats||o;this.timeAgo=function(e){var t=p.parseDate(e),s=+(new Date),o=s-t,h;return t?isNaN(o)||o<u*2?i("now"):o<a?(h=Math.floor(o/u),i(r.abbr,{number:h,symbol:i(c,{abbr:i("s"),expanded:h>1?i("seconds"):i("second")})})):o<f?(h=Math.floor(o/a),i(r.abbr,{number:h,symbol:i(c,{abbr:i("m"),expanded:h>1?i("minutes"):i("minute")})})):o<l?(h=Math.floor(o/f),i(r.abbr,{number:h,symbol:i(c,{abbr:i("h"),expanded:h>1?i("hours"):i("hour")})})):o<l*365?i(r.shortdate,{day:t.getDate(),month:i(n[t.getMonth()])}):i(r.longdate,{day:t.getDate(),month:i(n[t.getMonth()]),year:t.getFullYear().toString().slice(2)}):""},this.localTimeStamp=function(e){var t=p.parseDate(e),s=t&&t.getHours();return t?i(r.full,{day:t.getDate(),month:i(n[t.getMonth()]),year:t.getFullYear(),hours24:h(s),hours12:s<13?s?s:"12":s-12,minutes:h(t.getMinutes()),seconds:h(t.getSeconds()),amPm:s<12?i("AM"):i("PM")}):""}}var n=/(\d{4})-?(\d{2})-?(\d{2})T(\d{2}):?(\d{2}):?(\d{2})(Z|[\+\-]\d{2}:?\d{2})/,r=/[a-z]{3,4} ([a-z]{3}) (\d{1,2}) (\d{1,2}):(\d{2}):(\d{2}) ([\+\-]\d{2}:?\d{2}) (\d{4})/i,i=/^\d+$/,s=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],o={abbr:"%{number}%{symbol}",shortdate:"%{day} %{month}",longdate:"%{day} %{month} %{year}",full:"%{hours12}:%{minutes} %{amPm} - %{day} %{month} %{year}"},u=1e3,a=u*60,f=a*60,l=f*24,c='<abbr title="%{expanded}">%{abbr}</abbr>';p.parseDate=function(e){var o=e||"",u=o.toString(),a,f;return a=function(){var e;if(i.test(u))return parseInt(u,10);if(e=u.match(r))return Date.UTC(e[7],t.indexOf(s,e[1]),e[2],e[3],e[4],e[5]);if(e=u.match(n))return Date.UTC(e[1],e[2]-1,e[3],e[4],e[5],e[6])}(),a?(f=new Date(a),!isNaN(f.getTime())&&f):!1},e(p)})});
provide("tfw/util/assets",function(e){using("util/env",function(t){function r(e,r){var i=n[e],s;return t.retina()?s="2x":t.ie6()||t.ie7()?s="gif":s="default",r&&(s+=".rtl"),i[s]}var n={"embed/timeline.css":{"default":"embed/timeline.4c7bdf7c22f411f2ff2324c8d6b08523.default.css","2x":"embed/timeline.4c7bdf7c22f411f2ff2324c8d6b08523.2x.css",gif:"embed/timeline.4c7bdf7c22f411f2ff2324c8d6b08523.gif.css","default.rtl":"embed/timeline.4c7bdf7c22f411f2ff2324c8d6b08523.default.rtl.css","2x.rtl":"embed/timeline.4c7bdf7c22f411f2ff2324c8d6b08523.2x.rtl.css","gif.rtl":"embed/timeline.4c7bdf7c22f411f2ff2324c8d6b08523.gif.rtl.css"}};e(r)})});
provide("tfw/widget/syndicatedbase",function(e){using("tfw/widget/base","tfw/widget/intent","tfw/util/assets","tfw/util/globals","dom/classname","dom/delegate","dom/sandbox","util/env","util/twitter","util/util",function(t,n,r,i,s,o,u,a,f,l){function y(){v=E.VALID_COLOR.test(i.val("widgets:link-color"))&&RegExp.$1,g=E.VALID_COLOR.test(i.val("widgets:border-color"))&&RegExp.$1,m=i.val("widgets:theme")}function b(e,t,n){var r;n=n||document;if(n.getElementById(e))return;r=n.createElement("link"),r.id=e,r.rel="stylesheet",r.type="text/css",r.href=twttr.widgets.config.assetUrl()+"/"+t,n.getElementsByTagName("head")[0].appendChild(r)}function w(e){b("twitter-widget-css",r("embed/timeline.css"),e)}function E(e){if(!e)return;var n,r,i=this;this.sandboxReadyCallbacks=[],t.apply(this,[e]),n=this.params(),this.targetEl=this.srcEl&&this.srcEl.parentNode||n.targetEl||document.body,this.containerWidth=this.targetEl&&this.targetEl.offsetWidth,r=n.width||this.attr("width")||this.containerWidth||this.dimensions.DEFAULT_WIDTH,this.height=E.VALID_UNIT.test(n.height||this.attr("height"))&&RegExp.$1,this.width=Math.max(this.dimensions.MIN_WIDTH,Math.min(E.VALID_UNIT.test(r)?RegExp.$1:this.dimensions.DEFAULT_WIDTH,this.dimensions.DEFAULT_WIDTH)),this.narrow=n.narrow||this.width<=this.dimensions.NARROW_WIDTH,this.narrow&&this.classAttr.push("var-narrow"),E.VALID_COLOR.test(n.linkColor||this.dataAttr("link-color"))?this.linkColor=RegExp.$1:this.linkColor=v,E.VALID_COLOR.test(n.borderColor||this.dataAttr("border-color"))?this.borderColor=RegExp.$1:this.borderColor=g,this.theme=n.theme||this.attr("data-theme")||m,this.theme=/(dark|light)/.test(this.theme)?this.theme:"",this.classAttr.push(a.touch()?"is-touch":"not-touch"),u(function(e){i.sandboxReady=!0,i.setupSandbox.call(i,e)},{"class":this.renderedClassNames,id:this.id},{width:"1px",height:"1px",border:"none",position:"absolute"},function(e){i.srcEl?i.targetEl.insertBefore(e,i.srcEl):i.targetEl.appendChild(e)})}var c=[".customisable",".customisable:link",".customisable:visited",".customisable:hover",".customisable:focus",".customisable:active",".customisable-highlight:hover",".customisable-highlight:focus","a:hover .customisable-highlight","a:focus .customisable-highlight"],h=["a:hover .ic-mask","a:focus .ic-mask"],p=[".customisable-border"],d=[".timeline-header h1.summary",".timeline-header h1.summary a:link",".timeline-header h1.summary a:visited"],v,m,g;E.prototype=new t,l.aug(E.prototype,{setupSandbox:function(e){var t=e.doc,n=t.createElement("base"),r=t.createElement("style"),i=t.getElementsByTagName("head")[0],s="body{display:none}",o=this,u;this.sandbox=e,e.frame.title=this.a11yTitle,w(e.doc),n.target="_blank",i.appendChild(n),a.cspEnabled()||(r.type="text/css",r.styleSheet?r.styleSheet.cssText=s:r.appendChild(t.createTextNode(s)),i.appendChild(r)),this.handleResize&&window.addEventListener?window.addEventListener("resize",function(){o.handleResize()},!0):document.body.attachEvent("onresize",function(){o.handleResize()}),e.win.onresize=function(){o.handleResize&&o.handleResize()},this.frameIsReady=!0;for(;u=this.sandboxReadyCallbacks.shift();)u.fn.apply(u.context,u.args)},callsWhenSandboxReady:function(e){var t=this;return function(){var n=[],r=arguments.length,i=0;for(;i<r;i++)n.push(arguments[i]);t.callIfSandboxReady(e,t,n)}},callIfSandboxReady:function(e,t,n){n=n||[],t.frameIsReady?e.apply(t,[!1].concat(n)):t.sandboxReadyCallbacks.push({fn:e,context:t,args:[!0].concat(n)})},contentWidth:function(){var e=this.dimensions,t=this.chromeless&&this.narrow?e.NARROW_MEDIA_PADDING_CL:this.chromeless?e.WIDE_MEDIA_PADDING_CL:this.narrow?e.NARROW_MEDIA_PADDING:e.WIDE_MEDIA_PADDING;return this.width-t},addSiteStyles:function(){var e=this,t=this.sandbox.doc,n=this.id+"-styles",r,i=function(t){return(e.theme=="dark"?".thm-dark ":"")+t},s=[];if(a.cspEnabled())return;if(t.getElementById(n))return;this.headingStyle&&s.push(l.map(d,i).join(",")+"{"+this.headingStyle+"}"),this.linkColor&&(s.push(l.map(c,i).join(",")+"{color:"+this.linkColor+"}"),s.push(l.map(h,i).join(",")+"{background-color:"+this.linkColor+"}")),this.borderColor&&s.push(l.map(p,i).concat(this.theme=="dark"?[".thm-dark.customisable-border"]:[]).join(",")+"{border-color:"+this.borderColor+"}");if(!s.length)return;r=t.createElement("style"),r.id=n,r.type="text/css",r.styleSheet?r.styleSheet.cssText=s.join(""):r.appendChild(t.createTextNode(s.join(""))),t.getElementsByTagName("head")[0].appendChild(r)},bindIntentHandlers:function(){var e=this,t=this.element;o.delegate(t,"click",".profile",function(t){var r;e.addUrlParams(this),r=f.intentForProfileURL(this.href);if(t.altKey||t.metaKey||t.shiftKey)return;r&&(n.open(r,e.sandbox.frame),o.preventDefault(t))}),o.delegate(t,"click",".web-intent",function(t){e.addUrlParams(this);if(t.altKey||t.metaKey||t.shiftKey)return;n.open(this.href,e.sandbox.frame),o.preventDefault(t)})}}),E.VALID_UNIT=/^([0-9]+)( ?px)?$/,E.VALID_COLOR=/^(#(?:[0-9a-f]{3}|[0-9a-f]{6}))$/i,E.retinize=function(e){if(!a.retina())return;var t=e.getElementsByTagName("IMG"),n,r,i=0,s=t.length;for(;i<s;i++)n=t[i],r=n.getAttribute("data-src-2x"),r&&(n.src=r)},E.scaleDimensions=function(e,t,n,r){return t>e&&t>r?(e*=r/t,t=r):e>n&&(t*=n/e,e=n,t>r&&(e*=r/t,t=r)),{width:Math.ceil(e),height:Math.ceil(t)}},E.constrainMedia=function(e,t){var n=e.getElementsByTagName("IMG"),r=e.getElementsByTagName("IFRAME"),i,s,o,u=0,a=0,f;for(;i=[n,r][a];a++)if(i.length)for(f=0;s=i[f];f++)o=E.scaleDimensions(s.getAttribute("width")||s.width,s.getAttribute("height")||s.height,t,375),o.width>0&&(s.width=o.width),o.height>0&&(s.height=o.height),u=o.height>u?o.height:u;return u},y(),e(E)})});
provide("tfw/widget/timeline",function(e){using("tfw/widget/syndicatedbase","util/datetime","anim/transition","tfw/util/article","tfw/util/data","tfw/util/tracking","tfw/util/params","util/css","util/env","util/iframe","util/insert","util/throttle","util/twitter","util/querystring","util/typevalidator","util/util","dom/delegate","dom/classname","dom/get",function(t,n,r,i,s,o,u,a,f,l,c,h,p,d,v,m,g,y,b){function I(e){if(!e)return;var n,r,i,s,o,u,f;this.a11yTitle=this._("Twitter Timeline Widget"),t.apply(this,[e]),n=this.params(),r=(n.chrome||this.dataAttr("chrome")||"").split(" "),this.preview=n.previewParams,this.widgetId=n.widgetId||this.dataAttr("widget-id"),this.instanceId=++F,(s=n.screenName||this.dataAttr("screen-name"))||(o=n.userId||this.dataAttr("user-id"))?this.override={overrideType:"user",overrideId:o,overrideName:s,withReplies:v.asBoolean(n.showReplies||this.dataAttr("show-replies"))?"true":"false"}:(s=n.favoritesScreenName||this.dataAttr("favorites-screen-name"))||(o=n.favoritesUserId||this.dataAttr("favorites-user-id"))?this.override={overrideType:"favorites",overrideId:o,overrideName:s}:((s=n.listOwnerScreenName||this.dataAttr("list-owner-screen-name"))||(o=n.listOwnerId||this.dataAttr("list-owner-id")))&&((u=n.listId||this.dataAttr("list-id"))||(f=n.listSlug||this.dataAttr("list-slug")))?this.override={overrideType:"list",overrideOwnerId:o,overrideOwnerName:s,overrideId:u,overrideName:f}:this.override={},this.tweetLimit=v.asInt(n.tweetLimit||this.dataAttr("tweet-limit")),this.staticTimeline=this.tweetLimit>0,r.length&&(i=~m.indexOf(r,"none"),this.chromeless=i||~m.indexOf(r,"transparent"),this.headerless=i||~m.indexOf(r,"noheader"),this.footerless=i||~m.indexOf(r,"nofooter"),this.borderless=i||~m.indexOf(r,"noborders"),this.noscrollbar=~m.indexOf(r,"noscrollbar")),this.headingStyle=a.sanitize(n.headingStyle||this.dataAttr("heading-style"),undefined,!0),this.classAttr.push("twitter-timeline-rendered"),this.ariaPolite=n.ariaPolite||this.dataAttr("aria-polite")}function q(e,n){var r=e.ownerDocument,i=b.one(O,e,"DIV"),s=i&&i.children[0],o=s&&s.getAttribute("data-expanded-media"),u,a=0,f=b.one(M,e,"A"),l=f&&f.getElementsByTagName("B")[0],c=l&&(l.innerText||l.textContent),h;if(!l)return;l.innerHTML=f.getAttribute("data-toggled-text"),f.setAttribute("data-toggled-text",c);if(y.present(e,A)){y.remove(e,A);if(!i)return;i.style.cssText="",s.innerHTML="";return}o&&(u=r.createElement("DIV"),u.innerHTML=o,t.retinize(u),a=t.constrainMedia(u,n),s.appendChild(u)),i&&(h=Math.max(s.offsetHeight,a),i.style.cssText="height:"+h+"px"),y.add(e,A)}var w="1.0",E={CLIENT_SIDE_USER:0,CLIENT_SIDE_APP:2},S="timeline",x="new-tweets-bar",T="timeline-header",N="timeline-footer",C="stream",k="h-feed",L="tweet",A="expanded",O="detail-expander",M="expand",_="permalink",D="twitter-follow-button",P="no-more-pane",H="pending-scroll-in",B="pending-new-tweet",j="show-new-tweet",F=0;I.prototype=new t,m.aug(I.prototype,{renderedClassNames:"twitter-timeline twitter-timeline-rendered",dimensions:{DEFAULT_HEIGHT:"600",DEFAULT_WIDTH:"520",NARROW_WIDTH:"320",MIN_WIDTH:"180",MIN_HEIGHT:"200",WIDE_MEDIA_PADDING:81,NARROW_MEDIA_PADDING:16,WIDE_MEDIA_PADDING_CL:60,NARROW_MEDIA_PADDING_CL:12},create:function(e){var n=this.sandbox.doc.createElement("div"),r,s=this,u,a,f,l=[],c,h;n.innerHTML=e.body,r=n.children[0]||!1;if(!r)return;this.reconfigure(e.config),this.discardStaticOverflow(r),this.augmentWidgets(r),t.retinize(r),t.constrainMedia(r,this.contentWidth()),this.searchQuery=r.getAttribute("data-search-query"),this.profileId=r.getAttribute("data-profile-id"),c=this.getTweetDetails(n);for(h in c)c.hasOwnProperty(h)&&l.push(h);return o.enqueue({page:"timeline",component:"timeline",element:"initial",action:l.length?"results":"no_results"},{widget_id:this.widgetId,widget_origin:i.url(),item_ids:l,item_details:c,client_version:w,message:this.partner,query:this.searchQuery,profile_id:this.profileId},!0,this.dnt),o.flush(),this.ariaPolite=="assertive"&&(a=b.one(x,r,"DIV"),a.setAttribute("aria-polite","assertive")),r.id=this.id,r.className+=" "+this.classAttr.join(" "),r.lang=this.lang,twttr.widgets.load(r),f=function(){s.sandbox.body.appendChild(r),s.staticTimeline?s.sandbox.win.setTimeout(function(){s.sandbox.frame.height=s.height=r.offsetHeight},500):s.sandbox.win.setTimeout(function(){var e=b.one(T,r,"DIV"),t=b.one(N,r,"DIV"),n=b.one(C,r,"DIV");t?u=e.offsetHeight+t.offsetHeight:u=e.offsetHeight,n.style.cssText="height:"+(s.height-u-2)+"px",s.noscrollbar&&s.hideStreamScrollBar()},500),s.sandbox.frame.style.cssText="",s.sandbox.frame.width=s.width,s.sandbox.frame.height=s.height,s.sandbox.frame.style.border="none",s.sandbox.frame.style.maxWidth="100%",s.sandbox.frame.style.minWidth=s.dimensions.MIN_WIDTH+"px"},this.callsWhenSandboxReady(f)(),this.srcEl&&this.srcEl.parentNode&&this.srcEl.parentNode.removeChild(this.srcEl),r},render:function(e,t){function u(){r.success=function(e){n.element=n.create(e),n.readTranslations(),n.bindInteractions(),t&&t(n.sandbox.frame);return},r.error=function(e){e&&e.headers&&t&&t(e.headers.status)},r.params=n.preview,s.timelinePreview(r);return}function a(){o.initPostLogging(),s.timeline(m.aug({id:n.widgetId,instanceId:n.instanceId,dnt:n.dnt,lang:n.lang,success:function(e){n.element=n.create(e),n.readTranslations(),n.bindInteractions(),e.headers.xPolling&&/\d/.test(e.headers.xPolling)&&(n.pollInterval=e.headers.xPolling*1e3),n.updateTimeStamps(),n.staticTimeline||n.schedulePolling(),t&&t(n.sandbox.frame);return},error:function(e){e&&e.headers&&t&&t(e.headers.status)}},n.override))}var n=this,r={},i;if(!this.preview&&!this.widgetId){t&&t(400);return}i=this.preview?u:a,this.sandboxReady?i():window.setTimeout(i,0)},reconfigure:function(e){this.lang=e.lang,this.theme||(this.theme=e.theme),this.theme=="dark"&&this.classAttr.push("thm-dark"),this.chromeless&&this.classAttr.push("var-chromeless"),this.borderless&&this.classAttr.push("var-borderless"),this.headerless&&this.classAttr.push("var-headerless"),this.footerless&&this.classAttr.push("var-footerless"),this.staticTimeline&&this.classAttr.push("var-static"),!this.linkColor&&e.linkColor&&t.VALID_COLOR.test(e.linkColor)&&(this.linkColor=RegExp.$1),this.addSiteStyles(),!this.height&&t.VALID_UNIT.test(e.height)&&(this.height=RegExp.$1),this.height=Math.max(this.dimensions.MIN_HEIGHT,this.height?this.height:this.dimensions.DEFAULT_HEIGHT),this.preview&&this.classAttr.push("var-preview"),this.narrow=this.width<=this.dimensions.NARROW_WIDTH,this.narrow&&this.classAttr.push("var-narrow")},getTweetDetails:function(e){var t=b.one(k,e),n,r={},i,s,o,u,a={TWEET:0,RETWEET:10},f=0;n=t&&t.children||[];for(;i=n[f];f++)s=b.one(_,i,"A"),o=i.getAttribute("data-rendered-tweet-id")||p.status(s.href),u=i.getAttribute("data-tweet-id"),o===u?r[o]={item_type:a.TWEET}:r[o]={item_type:a.RETWEET,target_type:a.TWEET,target_id:u};return r},bindInteractions:function(){var e=this,t=this.element,n=!0;this.bindIntentHandlers(),g.delegate(t,"click",".load-tweets",function(t){n&&(n=!1,e.forceLoad(),g.stop(t))}),g.delegate(t,"click",".display-sensitive-image",function(n){e.showNSFW(b.ancestor("."+L,this,t)),g.stop(n)}),g.delegate(t,"mouseover","."+S,function(){e.mouseOver=!0}),g.delegate(t,"mouseout","."+S,function(){e.mouseOver=!1}),g.delegate(t,"mouseover","."+x,function(){e.mouseOverNotifier=!0}),g.delegate(t,"mouseout","."+x,function(){e.mouseOverNotifier=!1,window.setTimeout(function(){e.hideNewTweetNotifier()},3e3)});if(this.staticTimeline)return;g.delegate(t,"click","."+M,function(n){if(n.altKey||n.metaKey||n.shiftKey)return;q(b.ancestor("."+L,this,t),e.contentWidth()),g.stop(n)}),g.delegate(t,"click","A",function(e){g.stopPropagation(e)}),g.delegate(t,"click",".with-expansion",function(t){q(this,e.contentWidth()),g.stop(t)}),g.delegate(t,"click",".load-more",function(){e.loadMore()}),g.delegate(t,"click","."+x,function(){e.scrollToTop(),e.hideNewTweetNotifier(!0)})},scrollToTop:function(){var e=b.one(C,this.element,"DIV");e.scrollTop=0,e.focus()},update:function(){var e=this,t=b.one(L,this.element,"LI"),n=t&&t.getAttribute("data-tweet-id");this.updateTimeStamps(),this.requestTweets(n,!0,function(t){t.childNodes.length>0&&e.insertNewTweets(t)})},loadMore:function(){var e=this,t=b.all(L,this.element,"LI").pop(),n=t&&t.getAttribute("data-tweet-id");this.requestTweets(n,!1,function(t){var r=b.one(P,e.element,"P"),i=t.childNodes[0];r.style.cssText="",i&&i.getAttribute("data-tweet-id")==n&&t.removeChild(i);if(t.childNodes.length>0){e.appendTweets(t);return}y.add(e.element,"no-more"),r.focus()})},forceLoad:function(){var e=this,t=!!b.all(k,this.element,"OL").length;this.requestTweets(1,!0,function(n){n.childNodes.length&&(e[t?"insertNewTweets":"appendTweets"](n),y.add(e.element,"has-tweets"))})},schedulePolling:function(e){var t=this;if(this.pollInterval===null)return;e=twttr.widgets.poll||e||this.pollInterval||1e4,e>-1&&window.setTimeout(function(){this.isUpdating||t.update(),t.schedulePolling()},e)},requestTweets:function(e,n,r){var u=this,a={id:this.widgetId,instanceId:this.instanceId,screenName:this.widgetScreenName,userId:this.widgetUserId,withReplies:this.widgetShowReplies,dnt:this.dnt,lang:this.lang};a[n?"sinceId":"maxId"]=e,a.complete=function(){this.isUpdating=!1},a.error=function(e){if(e&&e.headers){if(e.headers.status=="404"){u.pollInterval=null;return}if(e.headers.status=="503"){u.pollInterval*=1.5;return}}},a.success=function(e){var s=u.sandbox.doc.createDocumentFragment(),a=u.sandbox.doc.createElement("div"),f=[],l,c;e&&e.headers&&e.headers.xPolling&&/\d+/.test(e.headers.xPolling)&&(u.pollInterval=e.headers.xPolling*1e3);if(e&&e.body!==undefined){a.innerHTML=e.body;if(a.children[0]&&a.children[0].tagName!="LI")return;l=u.getTweetDetails(a);for(c in l)l.hasOwnProperty(c)&&f.push(c);f.length&&(o.enqueue({page:"timeline",component:"timeline",element:n?"newer":"older",action:"results"},{widget_id:u.widgetId,widget_origin:i.url(),item_ids:f,item_details:l,client_version:w,message:u.partner,query:u.searchQuery,profile_id:u.profileId,event_initiator:n?E.CLIENT_SIDE_APP:E.CLIENT_SIDE_USER},!0,u.dnt),o.flush()),t.retinize(a),t.constrainMedia(a,u.contentWidth());while(a.children[0])s.appendChild(a.children[0]);r(s)}},s.timelinePoll(m.aug(a,this.override))},insertNewTweets:function(e){var t=this,n=b.one(C,this.element,"DIV"),i=b.one(k,n,"OL"),s=i.offsetHeight,o;this.updateTimeStamps(),i.insertBefore(e,i.firstChild),o=i.offsetHeight-s;if(n.scrollTop>40||this.mouseIsOver()){n.scrollTop=n.scrollTop+o,this.showNewTweetNotifier();return}y.remove(this.element,H),i.style.cssText="margin-top: -"+o+"px",window.setTimeout(function(){n.scrollTop=0,y.add(t.element,H),f.cssTransitions()?i.style.cssText="":r.animate(function(e){e<o?i.style.cssText="margin-top: -"+(o-e)+"px":i.style.cssText=""},o,500,r.easeOut)},500),this.gcTweets(50)},appendTweets:function(e){var t=b.one(C,this.element,"DIV"),n=b.one(k,t,"OL");this.updateTimeStamps(),n.appendChild(e)},gcTweets:function(e){var t=b.one(k,this.element,"OL"),n=t.children.length,r;e=e||50;for(;n>e&&(r=t.children[n-1]);n--)t.removeChild(r)},showNewTweetNotifier:function(){var e=this,t=b.one(x,this.element,"DIV"),n=t.children[0];t.style.cssText="",y.add(this.element,B),t.removeChild(n),t.appendChild(n),y.replace(this.element,B,j),this.newNoticeDisplayTime=+(new Date),window.setTimeout(function(){e.hideNewTweetNotifier()},5e3)},hideNewTweetNotifier:function(e){var t=this;if(!e&&this.mouseOverNotifier)return;y.replace(this.element,j,B),window.setTimeout(function(){y.remove(t.element,B)},500)},augmentWidgets:function(e){var t=b.all(D,e,"A"),n=0,r;for(;r=t[n];n++)r.setAttribute("data-related",this.related),r.setAttribute("data-partner",this.partner),r.setAttribute("data-dnt",this.dnt),r.setAttribute("data-search-query",this.searchQuery),r.setAttribute("data-profile-id",this.profileId),this.width<250&&r.setAttribute("data-show-screen-name","false")},discardStaticOverflow:function(e){var t=b.one(k,e,"OL"),n;if(this.staticTimeline){this.height=0;while(n=t.children[this.tweetLimit])t.removeChild(n)}},hideStreamScrollBar:function(){var e=b.one(C,this.element,"DIV"),t=b.one(k,this.element,"OL"),n;e.style.width="",n=this.element.offsetWidth-t.offsetWidth,n>0&&(e.style.width=this.element.offsetWidth+n+"px")},readTranslations:function(){var e=this.element,t="data-dt-";this.datetime=new n(m.compact({phrases:{now:e.getAttribute(t+"now"),s:e.getAttribute(t+"s"),m:e.getAttribute(t+"m"),h:e.getAttribute(t+"h"),second:e.getAttribute(t+"second"),seconds:e.getAttribute(t+"seconds"),minute:e.getAttribute(t+"minute"),minutes:e.getAttribute(t+"minutes"),hour:e.getAttribute(t+"hour"),hours:e.getAttribute(t+"hours")},months:e.getAttribute(t+"months").split("|"),formats:{abbr:e.getAttribute(t+"abbr"),shortdate:e.getAttribute(t+"short"),longdate:e.getAttribute(t+"long")}}))},updateTimeStamps:function(){var e=b.all(_,this.element,"A"),t,n,r=0,i,s;for(;t=e[r];r++){i=t.getAttribute("data-datetime"),s=i&&this.datetime.timeAgo(i,this.i18n),n=t.getElementsByTagName("TIME")[0];if(!s)continue;if(n&&n.innerHTML){n.innerHTML=s;continue}t.innerHTML=s}},mouseIsOver:function(){return this.mouseOver},addUrlParams:function(e){var t=this,n={tw_w:this.widgetId,related:this.related,partner:this.partner,query:this.searchQuery,profile_id:this.profileId,original_referer:i.url(),tw_p:"embeddedtimeline"};return this.addUrlParams=u(n,function(e){var n=b.ancestor("."+L,e,t.element);return n&&{tw_i:n.getAttribute("data-tweet-id")}}),this.addUrlParams(e)},showNSFW:function(e){var n=b.one("nsfw",e,"DIV"),r,i,s=0,o,u,a,l;if(!n)return;i=t.scaleDimensions(n.getAttribute("data-width"),n.getAttribute("data-height"),this.contentWidth(),n.getAttribute("data-height")),r=!!(u=n.getAttribute("data-player")),r?a=this.sandbox.doc.createElement("iframe"):(a=this.sandbox.doc.createElement("img"),u=n.getAttribute(f.retina()?"data-image-2x":"data-image"),a.alt=n.getAttribute("data-alt"),l=this.sandbox.doc.createElement("a"),l.href=n.getAttribute("data-href"),l.appendChild(a)),a.title=n.getAttribute("data-title"),a.src=u,a.width=i.width,a.height=i.height,o=b.ancestor("."+O,n,e),s=i.height-n.offsetHeight,n.parentNode.replaceChild(r?a:l,n),o.style.cssText="height:"+(o.offsetHeight+s)+"px"},handleResize:function(){this.handleResize=h(function(){var e=Math.min(this.dimensions.DEFAULT_WIDTH,Math.max(this.dimensions.MIN_WIDTH,this.sandbox.frame.offsetWidth));if(!this.element)return;e<this.dimensions.NARROW_WIDTH?(this.narrow=!0,y.add(this.element,"var-narrow")):(this.narrow=!1,y.remove(this.element,"var-narrow")),this.noscrollbar&&this.hideStreamScrollBar()},50,this),this.handleResize()}}),e(I)})});
provide("tfw/widget/embed",function(e){using("tfw/widget/base","tfw/widget/syndicatedbase","util/datetime","tfw/util/params","dom/classname","dom/get","util/env","util/util","util/throttle","util/twitter","tfw/util/article","tfw/util/data","tfw/util/tracking",function(t,n,r,i,s,o,u,a,f,l,c,h,p){function g(e,t,n){var r=o.one("subject",e,"BLOCKQUOTE"),i=o.one("reply",e,"BLOCKQUOTE"),s=r&&r.getAttribute("data-tweet-id"),u=i&&i.getAttribute("data-tweet-id"),a={},f={};if(!s)return;a[s]={item_type:0},p.enqueue({page:"tweet",section:"subject",component:"tweet",action:"results"},{client_version:d,widget_origin:c.url(),message:t,item_ids:[s],item_details:a},!0,n);if(!u)return;f[u]={item_type:0},p.enqueue({page:"tweet",section:"conversation",component:"tweet",action:"results"},{client_version:d,widget_origin:c.url(),message:t,item_ids:[u],item_details:f,associations:{4:{association_id:s,association_type:4}}},!0,n)}function y(e,t,n){var r={};if(!e)return;r[e]={item_type:0},p.enqueue({page:"tweet",section:"subject",component:"rawembedcode",action:"no_results"},{client_version:d,widget_origin:c.url(),message:t,item_ids:[e],item_details:r},!0,n)}function b(e,t,n,r,i){m[e]=m[e]||[],m[e].push({s:n,f:r,r:i,lang:t})}function w(e){if(!e)return;var t,r,i;this.a11yTitle=this._("Embedded Tweet"),n.apply(this,[e]),t=this.params(),r=this.srcEl&&this.srcEl.getElementsByTagName("A"),i=r&&r[r.length-1],this.hideThread=(t.conversation||this.dataAttr("conversation"))=="none"||~a.indexOf(this.classAttr,"tw-hide-thread"),this.hideCard=(t.cards||this.dataAttr("cards"))=="hidden"||~a.indexOf(this.classAttr,"tw-hide-media");if((t.align||this.attr("align"))=="left"||~a.indexOf(this.classAttr,"tw-align-left"))this.align="left";else if((t.align||this.attr("align"))=="right"||~a.indexOf(this.classAttr,"tw-align-right"))this.align="right";else if((t.align||this.attr("align"))=="center"||~a.indexOf(this.classAttr,"tw-align-center"))this.align="center",this.containerWidth>this.dimensions.MIN_WIDTH*(1/.7)&&this.width>this.containerWidth*.7&&(this.width=this.containerWidth*.7);this.narrow=t.narrow||this.width<=this.dimensions.NARROW_WIDTH,this.narrow&&this.classAttr.push("var-narrow"),this.tweetId=t.tweetId||i&&l.status(i.href)}var d="2.0",v="tweetembed",m={};w.prototype=new n,a.aug(w.prototype,{renderedClassNames:"twitter-tweet twitter-tweet-rendered",dimensions:{DEFAULT_HEIGHT:"0",DEFAULT_WIDTH:"500",NARROW_WIDTH:"350",MIN_WIDTH:"220",MIN_HEIGHT:"0",WIDE_MEDIA_PADDING:32,NARROW_MEDIA_PADDING:32},create:function(e){var t=this.sandbox.doc.createElement("div"),r,i=this.sandbox.frame,s=i.style;t.innerHTML=e,r=t.children[0]||!1;if(!r)return;return this.theme=="dark"&&this.classAttr.push("thm-dark"),this.linkColor&&this.addSiteStyles(),this.augmentWidgets(r),n.retinize(r),n.constrainMedia(r,this.contentWidth()),r.id=this.id,r.className+=" "+this.classAttr.join(" "),r.lang=this.lang,twttr.widgets.load(r),this.sandbox.body.appendChild(r),s.cssText="",i.width=this.width,i.height=0,s.display="block",s.border="none",s.maxWidth="99%",s.minWidth=this.dimensions.MIN_WIDTH+"px",s.padding="0",g(r,this.partner,this.dnt),r},render:function(e,t){var n=this,r="",i=this.tweetId,s,o,u;if(!i)return;this.hideCard&&(r+="c"),this.hideThread&&(r+="t"),r&&(i+="-"+r),u=this.callsWhenSandboxReady(function(e){function r(){var e=n.sandbox.frame,t=e.style;n.srcEl&&n.srcEl.parentNode&&n.srcEl.parentNode.removeChild(n.srcEl),t.borderRadius="5px",t.margin="10px 0",t.border="#ddd 1px solid",t.borderTopColor="#eee",t.borderBottomColor="#bbb",t.boxShadow="0 1px 3px rgba(0,0,0,0.15)",n.align=="center"?(t.margin="7px auto",t.float="none"):n.align&&(n.width==n.dimensions.DEFAULT_WIDTH&&(e.width=n.dimensions.NARROW_WIDTH),t.float=n.align),n.handleResize()}var t;if((!window.getComputedStyle||n.sandbox.win.getComputedStyle(n.sandbox.body,null).display!=="none")&&n.element.offsetHeight)return r();t=window.setInterval(function(){(!window.getComputedStyle||n.sandbox.win.getComputedStyle(n.sandbox.body,null).display!=="none")&&n.element.offsetHeight&&(window.clearInterval(t),r())},100)}),s=this.callsWhenSandboxReady(function(e,r){n.element=n.create(r),n.readTimestampTranslations(),n.updateTimeStamps(),n.bindIntentHandlers(),t&&t(n.sandbox.frame)}),o=this.callsWhenSandboxReady(function(e){y(n.tweetId,n.partner,n.dnt)}),b(i,this.lang,s,o,u)},augmentWidgets:function(e){var t=o.all("twitter-follow-button",e,"A"),n,r=0;for(;n=t[r];r++)n.setAttribute("data-related",this.related),n.setAttribute("data-partner",this.partner),n.setAttribute("data-dnt",this.dnt),n.setAttribute("data-show-screen-name","false")},addUrlParams:function(e){var t=this,n={related:this.related,partner:this.partner,original_referer:c.url(),tw_p:v};return this.addUrlParams=i(n,function(e){var n=o.ancestor(".tweet",e,t.element);return{tw_i:n.getAttribute("data-tweet-id")}}),this.addUrlParams(e)},handleResize:function(){this.handleResize=f(function(){var e=this,t=Math.min(this.dimensions.DEFAULT_WIDTH,Math.max(this.dimensions.MIN_WIDTH,this.sandbox.frame.offsetWidth));if(!this.element)return;t<this.dimensions.NARROW_WIDTH?(this.narrow=!0,s.add(this.element,"var-narrow")):(this.narrow=!1,s.remove(this.element,"var-narrow")),window.setTimeout(function(){e.sandbox.frame.height=e.height=e.element.offsetHeight},0)},50,this),this.handleResize()},readTimestampTranslations:function(){var e=this.element,t="data-dt-",n=e.getAttribute(t+"months")||"";this.datetime=new r(a.compact({phrases:{AM:e.getAttribute(t+"am"),PM:e.getAttribute(t+"pm")},months:n.split("|"),formats:{full:e.getAttribute(t+"full")}}))},updateTimeStamps:function(){var e=o.one("long-permalink",this.element,"A"),t=e.getAttribute("data-datetime"),n=t&&this.datetime.localTimeStamp(t),r=e.getElementsByTagName("TIME")[0];if(!n)return;if(r&&r.innerHTML){r.innerHTML=n;return}e.innerHTML=n}}),w.fetchAndRender=function(){var e=m,t=[],n,r;m={};if(e.keys)t=e.keys();else for(n in e)e.hasOwnProperty(n)&&t.push(n);if(!t.length)return;p.initPostLogging(),r=e[t[0]][0].lang,h.tweets({ids:t.sort(),lang:r,complete:function(t){var n,r,i,s,o,u,a=[];for(n in t)if(t.hasOwnProperty(n)){o=e[n]&&e[n];for(i=0;o.length&&(s=o[i]);i++)s.s&&(s.s.call(this,t[n]),s.r&&a.push(s.r));delete e[n]}for(i=0;u=a[i];i++)u.call(this);for(r in e)if(e.hasOwnProperty(r)){o=e[r];for(i=0;o.length&&(s=o[i]);i++)s.f&&s.f.call(this,t[n])}p.flush()}})},t.afterLoad(w.fetchAndRender),e(w)})});
provide("dom/textsize",function(e){function n(e,t,n){var r=[],i=0,s;for(;s=n[i];i++)r.push(s[0]),r.push(s[1]);return e+t+r.join(":")}function r(e){var t=e||"";return t.replace(/([A-Z])/g,function(e){return"-"+e.toLowerCase()})}var t={};e(function(e,i,s){var o=document.createElement("span"),u={},a="",f,l=0,c=0,h=[];s=s||[],i=i||"",a=n(e,i,s);if(t[a])return t[a];o.className=i+" twitter-measurement";try{for(;f=s[l];l++)o.style[f[0]]=f[1]}catch(p){for(;f=s[c];c++)h.push(r(f[0])+":"+f[1]);o.setAttribute("style",h.join(";")+";")}return o.innerHTML=e,document.body.appendChild(o),u.width=o.clientWidth||o.offsetWidth,u.height=o.clientHeight||o.offsetHeight,document.body.removeChild(o),delete o,t[a]=u})});
provide("tfw/widget/tweetbase",function(e){using("util/util","tfw/widget/base","util/querystring","util/twitter","util/uri",function(t,n,r,i,s){function a(e){if(!e)return;var t;n.apply(this,[e]),t=this.params(),this.text=t.text||this.dataAttr("text"),this.text&&/\+/.test(this.text)&&!/ /.test(this.text)&&(this.text=this.text.replace(/\+/g," ")),this.align=t.align||this.dataAttr("align")||"",this.via=t.via||this.dataAttr("via"),this.placeid=t.placeid||this.dataAttr("placeid"),this.hashtags=t.hashtags||this.dataAttr("hashtags"),this.screen_name=i.screenName(t.screen_name||t.screenName||this.dataAttr("button-screen-name")),this.url=t.url||this.dataAttr("url")}var o=document.title,u=encodeURI(location.href);a.prototype=new n,t.aug(a.prototype,{parameters:function(){var e={text:this.text,url:this.url,related:this.related,lang:this.lang,placeid:this.placeid,original_referer:location.href,id:this.id,screen_name:this.screen_name,hashtags:this.hashtags,partner:this.partner,dnt:this.dnt,_:+(new Date)};return t.compact(e),r.encode(e)}}),e(a)})});
provide("tfw/widget/tweetbutton",function(e){using("tfw/widget/tweetbase","util/util","util/querystring","util/uri","util/twitter","dom/textsize",function(t,n,r,i,s,o){var u=document.title,a=encodeURI(location.href),f=["vertical","horizontal","none"],l=function(e){t.apply(this,[e]);var r=this.params(),o=r.count||this.dataAttr("count"),l=r.size||this.dataAttr("size"),c=i.getScreenNameFromPage();if(r.type=="hashtag"||~n.indexOf(this.classAttr,"twitter-hashtag-button"))this.type="hashtag";else if(r.type=="mention"||~n.indexOf(this.classAttr,"twitter-mention-button"))this.type="mention";this.counturl=r.counturl||this.dataAttr("counturl"),this.searchlink=r.searchlink||this.dataAttr("searchlink"),this.button_hashtag=s.hashTag(r.button_hashtag||r.hashtag||this.dataAttr("button-hashtag"),!1),this.size=l=="large"?"l":"m",this.type?(this.count="none",c&&(this.related=this.related?c+","+this.related:c)):(this.text=this.text||u,this.url=this.url||i.getCanonicalURL()||a,this.count=~n.indexOf(f,o)?o:"horizontal",this.count=this.count=="vertical"&&this.size=="l"?"none":this.count,this.via=this.via||c)};l.prototype=new t,n.aug(l.prototype,{parameters:function(){var e={text:this.text,url:this.url,via:this.via,related:this.related,count:this.count,lang:this.lang,counturl:this.counturl,searchlink:this.searchlink,placeid:this.placeid,original_referer:location.href,id:this.id,size:this.size,type:this.type,screen_name:this.screen_name,button_hashtag:this.button_hashtag,hashtags:this.hashtags,align:this.align,partner:this.partner,dnt:this.dnt,_:+(new Date)};return n.compact(e),r.encode(e)},height:function(){return this.count=="vertical"?62:this.size=="m"?20:28},width:function(){var e={ver:8,cnt:14,btn:24,xlcnt:18,xlbtn:38},t=this.count=="vertical",r=this.type=="hashtag"&&this.button_hashtag?"Tweet %{hashtag}":this.type=="mention"&&this.screen_name?"Tweet to %{name}":"Tweet",i=this._(r,{name:"@"+this.screen_name,hashtag:"#"+this.button_hashtag}),s=this._("K"),u=this._("100K+"),a=(t?"8888":"88888")+s,f=0,l=0,c=0,h=0,p=this.styles.base,d=p;return~n.indexOf(["ja","ko"],this.lang)?a+=this._("10k unit"):a=a.length>u.length?a:u,t?(d=p.concat(this.styles.vbubble),h=e.ver,c=e.btn):this.size=="l"?(p=d=p.concat(this.styles.large),c=e.xlbtn,h=e.xlcnt):(c=e.btn,h=e.cnt),this.count!="none"&&(l=o(a,"",d).width+h),f=o(i,"",p.concat(this.styles.button)).width+c,t?f>l?f:l:this.calculatedWidth=f+l},render:function(e,t){var n=twttr.widgets.config.assetUrl()+"/widgets/tweet_button.1378258117.html#"+this.parameters();this.count&&this.classAttr.push("twitter-count-"+this.count),this.element=this.create(n,this.dimensions(),{title:this._("Twitter Tweet Button")}),t&&t(this.element)}}),e(l)})});
provide("tfw/widget/follow",function(e){using("util/util","tfw/widget/base","util/querystring","util/uri","util/twitter","dom/textsize",function(t,n,r,i,s,o){function u(e){if(!e)return;var t,r,i,o,u;n.apply(this,[e]),t=this.params(),r=t.size||this.dataAttr("size"),i=t.showScreenName||this.dataAttr("show-screen-name"),u=t.count||this.dataAttr("count"),this.classAttr.push("twitter-follow-button"),this.showScreenName=i!="false",this.showCount=t.showCount!==!1&&this.dataAttr("show-count")!="false",u=="none"&&(this.showCount=!1),this.explicitWidth=t.width||this.dataAttr("width")||"",this.screenName=t.screen_name||t.screenName||s.screenName(this.attr("href")),this.preview=t.preview||this.dataAttr("preview")||"",this.align=t.align||this.dataAttr("align")||"",this.size=r=="large"?"l":"m"}u.prototype=new n,t.aug(u.prototype,{parameters:function(){var e={screen_name:this.screenName,lang:this.lang,show_count:this.showCount,show_screen_name:this.showScreenName,align:this.align,id:this.id,preview:this.preview,size:this.size,partner:this.partner,dnt:this.dnt,_:+(new Date)};return t.compact(e),r.encode(e)},render:function(e,t){if(!this.screenName)return;var n=twttr.widgets.config.assetUrl()+"/widgets/follow_button.1378258117.html#"+this.parameters();this.element=this.create(n,this.dimensions(),{title:this._("Twitter Follow Button")}),t&&t(this.element)},width:function(){if(this.calculatedWidth)return this.calculatedWidth;if(this.explicitWidth)return this.explicitWidth;var e={cnt:13,btn:24,xlcnt:22,xlbtn:38},n=this.showScreenName?"Follow %{screen_name}":"Follow",r=this._(n,{screen_name:"@"+this.screenName}),i=~t.indexOf(["ja","ko"],this.lang)?this._("10k unit"):this._("M"),s=this._("%{followers_count} followers",{followers_count:"88888"+i}),u=0,a=0,f,l,c=this.styles.base;return this.size=="l"?(c=c.concat(this.styles.large),f=e.xlbtn,l=e.xlcnt):(f=e.btn,l=e.cnt),this.showCount&&(a=o(s,"",c).width+l),u=o(r,"",c.concat(this.styles.button)).width+f,this.calculatedWidth=u+a}}),e(u)})});
!function(){window.twttr=window.twttr||{},twttr.host=twttr.host||"platform.twitter.com",using("util/domready","util/env",function(e,t){function n(e){return(e||!/^http\:$/.test(window.location.protocol))&&!twttr.ignoreSSL?"https":"http"}if(t.ie6())return;if(twttr.widgets&&twttr.widgets.loaded)return twttr.widgets.load(),!1;if(twttr.init)return!1;twttr.init=!0,twttr._e=twttr._e||[],twttr.ready=twttr.ready||function(e){twttr.widgets&&twttr.widgets.loaded?e(twttr):twttr._e.push(e)},using.path.length||(using.path=n()+"://"+twttr.host+"/js"),twttr.ignoreSSL=twttr.ignoreSSL||!1;var r=[];twttr.events={bind:function(e,t){return r.push([e,t])}},e(function(){using("tfw/widget/base","tfw/widget/follow","tfw/widget/tweetbutton","tfw/widget/embed","tfw/widget/timeline","tfw/widget/intent","tfw/util/article","util/events","util/util",function(e,t,i,s,o,u,a,f,l){function m(e){var t=twttr.host;return n(e)=="https"&&twttr.secureHost&&(t=twttr.secureHost),n(e)+"://"+t}function g(){using("tfw/hub/client",function(e){twttr.events.hub=e.init(p),e.init(p,!0)})}var c,h,p={widgets:{"a.twitter-share-button":i,"a.twitter-mention-button":i,"a.twitter-hashtag-button":i,"a.twitter-follow-button":t,"blockquote.twitter-tweet":s,"a.twitter-timeline":o,body:u}},d=twttr.events&&twttr.events.hub?twttr.events:{},v;p.assetUrl=m,twttr.widgets=twttr.widgets||{},l.aug(twttr.widgets,{config:{assetUrl:m},load:function(t){e.init(p),e.embed(t),twttr.widgets.loaded=!0},createShareButton:function(e,t,n,r){if(!e||!t)return n&&n(!1);r=l.aug({},r||{},{url:e,targetEl:t}),(new i(r)).render(p,n)},createHashtagButton:function(e,t,n,r){if(!e||!t)return n&&n(!1);r=l.aug({},r||{},{hashtag:e,targetEl:t,type:"hashtag"}),(new i(r)).render(p,n)},createMentionButton:function(e,t,n,r){if(!e||!t)return n&&n(!1);r=l.aug({},r||{},{screenName:e,targetEl:t,type:"mention"}),(new i(r)).render(p,n)},createFollowButton:function(e,n,r,i){if(!e||!n)return r&&r(!1);i=l.aug({},i||{},{screenName:e,targetEl:n}),(new t(i)).render(p,r)},createTweet:function(e,t,n,r){if(!e||!t)return n&&n(!1);r=l.aug({},r||{},{tweetId:e,targetEl:t}),(new s(r)).render(p,n),s.fetchAndRender()},createTimeline:function(e,t,n,r){if(!e||!t)return n&&n(!1);r=l.aug({},r||{},{widgetId:e,targetEl:t}),(new o(r)).render(p,n)}}),l.aug(twttr.events,d,f.Emitter),v=twttr.events.bind,twttr.events.bind=function(e,t){g(),this.bind=v,this.bind(e,t)};for(c=0;h=r[c];c++)twttr.events.bind(h[0],h[1]);for(c=0;h=twttr._e[c];c++)h(twttr);twttr.ready=function(e){e(twttr)},/twitter\.com(\:\d+)?$/.test(document.location.host)&&(twttr.widgets.createTimelinePreview=function(e,t,n){if(!p||!t)return n&&n(!1);(new o({previewParams:e,targetEl:t,linkColor:e.link_color,theme:e.theme,height:e.height})).render(p,n)}),twttr.widgets.createTweetEmbed=twttr.widgets.createTweet,twttr.widgets.load()})})})}()});
Object.extend(RegExp, new function() {
	var regExpSpecialChars = ['\\', '.', '+', '*', '?', '[', '^', ']', '$', '(', ')', '{', '}', '=', '!', '<', '>', '|', ':', '/']
	
	this.escape = function(string) {
		for (var i = 0; i < regExpSpecialChars.length; i++) {
			string = string.replace(new RegExp('\\' + regExpSpecialChars[i], 'g'), '\\' + regExpSpecialChars[i])
		}
		return string
	}
})
Object.extend(String.prototype, {
	strip: function() {	
		return this.length ? this.replace(/^\s+/, '').replace(/\s+$/, '') : ''
		
	},
	
	sprintf: function() {
		var string = this
		var args = $A(arguments)
		while (args.length) {
			var index = string.search(/%[sdp]/)
			var type = index > -1 ? string.substr(index + 1, 1) : false
			if (type) {
				var value = args.shift()
				switch (type) {
					case 's':
					case 'p':
						value = value.inspect()
						
				}
				string = string.substr(0, index) + value + string.substring(index + 2, string.length)
			} else {
				break
			}
		}
		return string
	},
	
	rjust: function(width, padding) {
		var string = this
		while (string.length < width) {
			string = (padding || ' ') + string
		}
		return string
	},
	
	toQueryParams: function() {
		var pairs = this.split('&')
		return pairs.inject({}, function(params, pair) {
			var pair = pair.split('=')
			params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1])
			return params
		})
	},
	
	underscore: function() {
		return this.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
	}
})
Object.extend(Element, {
	setAttributes: function(elements, attributes) {
		if (typeof elements.length == 'undefined') {
			elements = [elements]
		}
		for (var i = 0; i < elements.length; i++) {
			var element = $(elements[i])
			for (var key in attributes) {
				var attrName = key
				if (Prototype.Browser.IE && key == 'class') {
					//attrName = 'className'
				}
				element.setAttribute(attrName, attributes[key])
			}
		}
		return element
	},
	
	insertAfter: function(newElement, referenceElement) {
		referenceElement.nextSibling ? referenceElement.parentNode.insertBefore(newElement, referenceElement.nextSibling) : referenceElement.parentNode.appendChild(newElement)
		return newElement
	},
	
	//Desactiva un elemento y le da aspecto como tal
	disable: function(element) {
		switch (element.tagName.toLowerCase()) {
			case 'input':
				switch (element.type) {
					case 'text':
						element.style.backgroundColor = view.colors.get('disabled')
				}
				element.disabled = true
				break
			case 'button':
				var img = element.getElementsByTagName('img')[0]
				if (img)
					Element.disable(img)
				else
					Element.setOpacity(element, 0.3)
				element.disabled = true
				break
			case 'img':
				Element.setOpacity(element, 0.3)
				break
			case 'select':
				element.disabled = true
				break
			default:
				throw("Unsupported tag '" + element.tagName.toLowerCase() + "' for disable")
		}
	},
	
	enable: function(element) {
		switch (element.tagName.toLowerCase()) {
			case 'input':
				switch (element.type) {
					case 'text':
						element.style.backgroundColor = ''
				}
				element.disabled = false
				break
			case 'button':
				var img = element.getElementsByTagName('img')[0]
				if (img)
					Element.enable(img)
				else
					Element.setOpacity(element, 1)
				element.disabled = false
				break
			case 'img':
				Element.setOpacity(element, 1)
				break
			case 'select':
				element.disabled = false
				break
			default:
				throw("Unsupported tag '" + element.tagName.toLowerCase() + "' for enable")
		}
	},
	
	getContentWidth: function(element) {
		return element.clientWidth - (parseInt(Element.getStyle(element, 'padding-left')) + parseInt(Element.getStyle(element, 'padding-right')))
	},
	
	scrollToViewport: function(element) {
		var viewOffsets = document.viewport.getScrollOffsets()
		var viewDimensions = document.viewport.getDimensions()
		var elmOffsets = Element.cumulativeOffset(element)
		var elmDimensions = Element.getDimensions(element)
		//alert('viewOffsets.top:' + viewOffsets.top + ' viewDimensions.height:' + viewDimensions.height + ' elmOffsets.top:' + elmOffsets.top + ' elmDimensions.height:' + elmDimensions.height)
		var left = viewOffsets.left, top = viewOffsets.top
		/*
		if (elmDimensions.width > viewDimensions.width) {
			if (elmOffsets.left < viewOffsets.left) left = elmOffsets.left
		} else if (elmOffsets.left < viewOffsets.left)
			left = elmOffsets.left
		else if (elmOffsets.left + elmDimensions.width > viewOffsets.left + viewDimensions.width)
			left = elmOffsets.left - (viewDimensions.height - elmDimensions.height)
		
		if (elmDimensions.height > viewDimensions.height) {//más grande que el viewport
			if (elmOffsets.top < viewOffsets.top) top = elmOffsets.top
		} else if (elmOffsets.top < viewOffsets.top) //empieza por arriba
			top = elmOffsets.top
		else if (elmOffsets.top + elmDimensions.height > viewOffsets.top + viewDimensions.height) //acaba fuera
			top = elmOffsets.top - (viewDimensions.height - elmDimensions.height)
		*/		
		if (elmDimensions.height > viewDimensions.height) { //más grande que el viewport
			if (Math.abs(viewOffsets.top - elmOffsets.top) <= Math.abs((viewOffsets.top + viewDimensions.height) - (elmOffsets.top + elmDimensions.height))) //¿qué está más cerca, el inicio o el final?
				top = elmOffsets.top
			else
				top = elmOffsets.top - (viewDimensions.height - elmDimensions.height)
		} else {
			if (elmOffsets.top < viewOffsets.top) //empieza por arriba
				top = elmOffsets.top
			else if (elmOffsets.top + elmDimensions.height > viewOffsets.top + viewDimensions.height) { //acaba fuera
				top = elmOffsets.top - (viewDimensions.height - elmDimensions.height)
			}
		}
		if (elmDimensions.width > viewDimensions.width) { //más grande que el viewport
			if (Math.abs(viewOffsets.left - elmOffsets.left) <= Math.abs((viewOffsets.left + viewDimensions.width) - (elmOffsets.left + elmDimensions.width))) //¿qué está más cerca, el inicio o el final?
				left = elmOffsets.left
			else
				left = elmOffsets.left - (viewDimensions.width - elmDimensions.width)
		} else {
			if (elmOffsets.left < viewOffsets.left) //empieza por arriba
				left = elmOffsets.left
			else if (elmOffsets.left + elmDimensions.width > viewOffsets.left + viewDimensions.width) { //acaba fuera
				left = elmOffsets.left - (viewDimensions.width - elmDimensions.width)
			}
		}
		

			
		//alert(top)
    	window.scrollTo(left, top)
	}
})
Object.extend(Event, new function() {
	this.fire = function(element, eventName) {
		if (element.dispatchEvent) { //w3c
			var event
			switch (eventName) {
				//mouse events
				case 'click':
					event = document.createEvent('MouseEvent')
					event.initMouseEvent(
						'click', //type
						true, //bubbles
						true, //cancelable
						window, //view
						1, //detail
						0, //screenX
						0, //screenY
						0, //clientX
						0, //clientY
						false, //ctrlKey
						false, //altKey
						false, //shiftKey
						false, //metaKey
						0, //button
						undefined //relatedTarget
					)
					break
						
				default:
					var event = document.createEvent('HTMLEvents')
					event.initEvent(eventName, true, true)
			}
			event.fake = true
			element.dispatchEvent(event)
		} else if (element.fireEvent) { //ie
			var event = document.createEventObject()
			event.fake = true
			element.fireEvent('on' + eventName, event)
		} else {
			throw('Unsupported Event.fire')
		}
	}
})
Object.extend(Form, {
	findFirstElement: function(form) {
		var nodes = form.getElementsByTagName('*')
		for (var i = 0; i < nodes.length; i++) {
			if (nodes[i].disabled) continue
			switch (nodes[i].tagName.toLowerCase()) {
				case 'input':
					if (nodes[i].type == 'hidden') continue
				case 'select':
				case 'textarea':
					if (nodes[i].readOnly) continue
					if (Element.getStyle(nodes[i], 'display') == 'none' || Element.getStyle(nodes[i], 'visibility') == 'hidden') continue
					return nodes[i]
			}
		}
		return null
	},

	isEmpty: function(form) {
		var empty = true
		var fields = Form.getElements(form)
		for (var i = 0; i < fields.length; i++) {
			if (!fields[i].disabled && fields[i].type != 'hidden') {
				var value = $F(fields[i])
				if (value && value.strip()) {
					empty = false
					break
				}
			}
		}
		return empty
	},
		
	photo: function(form) {
		Form.getElements(form).each(function(element) {
			if (element.defaultValue == undefined) {
				element.defaultValue = $F(element)
			}
		})
	},
	
	changed: function(form) {
		var changed = false
		Form.getElements(form).each(function(field) {
			if (element.defaultChecked != element.checked || element.defaultValue != element.value) {
				changed = true
				throw $break
			}
		})
		return changed
	}
})
Object.extend(Ajax.Autocompleter.prototype, {
	oldInitialize: Ajax.Autocompleter.prototype.initialize,
	oldOnObserverEvent: Ajax.Autocompleter.prototype.onObserverEvent,
	
	initialize: function(field, url, options) {
		var div = document.createElement('div')
		div.className = 'autoComplete'
		Element.insertAfter(div, field)
		if (!options) options = {}
		options.afterUpdateElement = function(field) {
			Event.fire(field, 'change')
		}
		if (field.validates && field.validates.rules.length) {
			options.minChars = field.validates.rules.length.min || field.validates.rules.length
		}
		options.tokens = [',']
		this.oldInitialize.call(this, field, div, controller.urlFor(url || {action: 'autocomplete_for_' + (field.id || field.name)}), options)
	},
  
	onObserverEvent: function() {
		if (!this.element.validates || this.element.validates.status == Validator.VALID) this.oldOnObserverEvent.call(this)
	},
     
  getUpdatedChoices: function() {
    this.startIndicator();
    
    var entry = encodeURIComponent(this.options.paramName) + '=' + 
      encodeURIComponent(this.getToken());

    this.options.parameters = this.options.callback ?
      this.options.callback(this.element, entry) : entry;

    if(this.options.defaultParams) 
      this.options.parameters += '&' + this.options.defaultParams;
  
    this.options.parameters += '&authenticity_token=' + controller.authenticity_token
    
    new Ajax.Request(this.url, this.options);
  }
})
var GetText = function() {

}

var _ = function(str) {
    return str
}
var Observable = {
	observers: null,
	
	observe: function(event, callBack) {
		if (!this.observers[event]) this.observers[event] = []
		this.observers[event].push(callBack)
	},
	
	notifyEventToObservers: function(event) {
		var observers = this.observers[event]
		if (observers) {
			var args = $A(arguments).slice(1)
			for (var i = 0, l = observers.length; i < l; i++) {
				observers[i].apply(undefined, args)
			}
		}
	},
	
	stopObserving: function(event, callBack) {
		this.observers[event].splice(this.observers[event].indexOf(callBack), 1)
	}
}
/*@cc_on var elm=['abbr','article','aside','audio','canvas','details','figcaption','figure','footer','header','hgroup','mark','meter','nav','output','progress','section','summary','time','video'];for(var i=0,l=elm.length;i<l;i++)document.createElement(elm[i])@*/
var View = {}
View.Controls = {}
var view = new function() {
	
	this.preSetUp = function() {		
		/*
		//this.browser.fix()
		
		//damos aspecto disabled a los botones con disabled = true
		var buttons = document.getElementsByTagName('button')
		var length = buttons.length
		for (var i = 0; i < length; i++) {
			var button = buttons[i]
			if (button.disabled) Element.disable(button)
		}*/
	}
	/*
	this.postSetUp = function() {
		//coloreamos campos cuando reciban el foco
		
		//aplicamos efecto destacado en los elementos con la clase highlighted
		//var highlighted = document.getElementsByClassName('highlighted')[0]
		//if (highlighted) this.highlighter.start(highlighted)
	}
	
	this.emphatizeFieldsOnFocus = function(element) {
		var tags = ['input', 'select', 'textarea']
		for (var i = 0, l = tags.length; i < l; i++) {
			var fields = element.getElementsByTagName(tags[i])
			for (var j = 0, m = fields.length; j < m; j++) {
				this.emphatizeOnFocus(fields[j])
			}
		}
	}
	
	// Colorea un campo cuando recibe el foco
	this.emphatizeOnFocus = function(field) {
		if (field.readOnly || field.type == 'hidden') return
		Event.observe(field, 'focus', function() {
			Element.addClassName(this, 'focused')
		}.bind(field))
		Event.observe(field, 'blur', function() {
			Element.removeClassName(this, 'focused')
		}.bind(field))
	}
	*/
	
	/*
	 * Crea un boton con su imagen
	 * 
	 * caption: false Texto que se muestra en el boton
	 * icon: false Ruta a una imagen 32x32
	 * order: ['icon', 'caption'] Array con el orden en el que se muestra el caption y el icon
	 */
	// Crea un ToolButton
	//
	// view.toolButton({})
	// caption: 'Press'
	// icon: 'img/add.gif'
	// title: 'Hello'
	// order: ['icon', 'caption']
	// disabled: true
	// id: 'press'
	this.toolButton = function(options) {
		options = Object.extend({
			type: 'button',
			order: ['icon', 'caption'],
			alt: options.title || options.caption || ''
		}, options)
		var button = document.createElement('button');
		(options.order).each(function(key, index) {
			if (index) button.appendChild(document.createTextNode(' '))
			switch (key) {
				case 'icon':
					button.appendChild(new Element('img', {src: options.icon, alt: options.alt}))
					break
				case 'caption':
					if (options.caption) button.appendChild(document.createTextNode(options.caption))
			}
		})
		delete options.order
		delete options.icon
		delete options.alt
		delete options.caption
		Element.writeAttribute(button, options)
		//if (options.disabled) Element.disable(button)
		return button
	}
	
	// Convierte un enlace en un boton
	this.anchorToButton = function(anchor, options) {
		if (anchor.id) options.id = anchor.id
		if (anchor.className) options['class'] = anchor.className
		if (anchor.href == document.location.toString() + '#') options.disabled = true
		options.caption = anchor.firstChild.nodeValue
		var button = view.toolButton(options)
		var href = anchor.href
		button.onclick = anchor.onclick || function() { location.assign(href) }
		anchor.removeAttribute('id')
		anchor.parentNode.replaceChild(button, anchor)
		return button
	}
	
	this.openDialog = function(url, height, width, scroll) {
		//this.closeDialog()
		if (!(url instanceof String)) url = controller.urlFor(url)
		var features = $H({
			toolbar: 0,
			location: 0,
			directories: 0,
			status: 0,
			resizable: 0,
			copyhistory: 0,
			scrollbars: scroll ? 1 : 0,
			width: width,
			height: height,
			top: Math.ceil((screen.availHeight - height) / 2),
			left: Math.ceil((screen.availWidth - width) / 2)
		}).collect(function(feature) { return feature[0] + '=' + feature[1] }).join(',')
		this.dialog = window.open(url, 'dialog', features)
		this.dialogInterval = setInterval(this.checkDialogWindowStatus.bind(this), 250)
		window.blur()
		//Event.observe(window, 'focus', this.onFocusParentWindow)
		this.dialog.focus()
	}
	
	this.closeDialog = function() {
		if (this.dialog) {
			if (this.dialog.closed) {
				this.dialog = null
			} else {
				this.dialog.close()
				this.dialog = null
			}
			//Event.stopObserving(window, 'focus', this.onFocusParentWindow)
		}
	}
	
	this.onFocusParentWindow = function() {
		if (this.dialog && !this.dialog.closed) {
			alert(this.dialog.closed)
			window.blur()
			this.dialog.focus()
		}
	}.bind(this)
	
	this.checkDialogWindowStatus = function() {
		if (this.dialog.closed) {
			clearInterval(this.dialogInterval)
			this.closeDialog()
			window.focus()
		}
	},
	//Desenmascara una dirección de email
	this.decodeMail = function(email, text) {
		var partsOut = []
		var parts = email.split('.').reverse()
		for (var i = 0, l = parts.length; i < l; i++) {
			var stringsOut = []
			var strings = parts[i].split('@').reverse()
			for (var j = 0, m = strings.length; j < m; j++) {
				var string = strings[j]
				stringsOut[j] = ''
				for (var k = string.length - 1; k >= 0; k--) stringsOut[j] += string[k]
			}
			partsOut[i] = stringsOut.join('.')
		}
		email = partsOut.join('@')
		document.write('<a href="mailto:' + email + '">' + (text || email) + '</a>')
	},
	
	this.shareButtons = function(buttons) {
		var url = document.location.toString().split('#')[0]
		var url_encoded = encodeURIComponent(url)
		var html = ''
		if (buttons.mn) html += '<iframe class=meneame src=http://www.meneame.net/api/check_url.php?url=' + url_encoded + ' frameborder=0 scrolling=no allowtransparency=true marginwidth=0 marginheight=0></iframe>'
		//http://developers.facebook.com/docs/reference/plugins/like/
		if (buttons.fb) html += '<iframe class=facebook src="http://www.facebook.com/plugins/like.php?app_id=216415245069532&amp;href=' + url_encoded + '&amp;send=false&amp;layout=box_count&amp;width=72&amp;show_faces=false&amp;action=like&amp;colorscheme=light&amp;height=60" scrolling=no frameborder=0 allowTransparency=true></iframe>'
		//http://twitter.com/about/resources/tweetbutton
		if (buttons.tw) html += '<a href=http://twitter.com/share class=twitter-share-button data-url="' + url + '" data-count=vertical data-via=bandaanchaeu data-lang=es>Tweet</a>'
		//http://www.google.com/webmasters/+1/button/index.html
		if (buttons.gp) html += '<g:plusone size=tall href="' + url + '"></g:plusone>'
		document.write(html)
	}
}

View.Controls.Pickable = {
	open: function() {
		if (this.status === undefined) {
			Element.setOpacity(this.div, 0)
			Element.show(this.div)
			//this.div.style.width = (this.div.scrollWidth + 2) + 'px'
		}
		if (this.opened) return false
		this.opened = true
		Element.addClassName(this.openerButton, 'pressed')
		this.place()
		Effect.Appear(this.div, {duration: 0.2})
		//capture events
		Event.observe(window, 'resize', this.onResize)
		Event.observe(Prototype.Browser.IE ? document.body : window, 'click', this.onClick)
	},
	
	close: function() {
		if (!this.opened) return
		this.opened = false
		Element.removeClassName(this.openerButton, 'pressed')
		Effect.Fade(this.div, {duration: 0.2})
		Event.stopObserving(window, 'resize', this.onResize)
		Event.stopObserving(Prototype.Browser.IE ? document.body : window, 'click', this.onClick)
	},
	
	toggle: function() {
		if (this.opened) {
			this.close()
		} else {
			this.open()
		}
	},
	
	place: function(where) {
		where = where || 'right bottom'
		var obj = this.openerButton
		var left = obj.offsetLeft
		var top = obj.offsetTop
		while (obj = obj.offsetParent) {
			left += obj.offsetLeft
			top += obj.offsetTop
		}
		if (where.search('left') > -1) {
			throw('Not implemented')
		} else if (where.search('right') > -1) {
			this.div.style.left	= left + 'px'
		} else {
			this.div.style.left	= (left - Math.round((this.div.offsetWidth - this.openerButton.offsetWidth) / 2)) + 'px'
		}
		if (where.search('top') > -1) {
			this.div.style.top = (top - this.div.offsetHeight) + 'px'
		} else if (where.search('bottom') > -1) {
			this.div.style.top	= (top + this.openerButton.offsetHeight) + 'px'
		} else {
			throw('Not implemented')
		}
	},
	
	onResize: function() {
		this.place()
	},
	
	onClick: function(event) {
		var target = Event.element(event || window.event)
		var close = true
		while (target.tagName && target.tagName.toLowerCase() != 'body') {
			if (target == this.div || target == this.openerButton) {
				close = false
				break
			}
			target = target.parentNode
		}
		close && this.close()
	}
}
View.Controls.Attachments = Class.create({
	// mode: 'select' | 'thumbnails'
	// length: {min: 2, max: 4}
	// order: 'user' | 'alpha'
	initialize: function(model, attachment, options) {
		this.model = model
		this.attachment = attachment
		this.options = options || {}
		
		this.select = document.getElementsByName(attachment + '[]')[0]
		this.disabled = this.select.disabled
		if (!this.disabled) {
            Event.observe(this.select, 'change', this.updateButtons.bind(this))
			this.drawForm = this.drawForm.bind(this)
			this.initForm = this.initForm.bind(this)
        }
		//remove field input
		//var input = document.getElementsByName(attachment + '_upload')[0]
		//input.parentNode.removeChild(input) 
		//build tool bar
		var div = document.createElement('div')
		div.style.textAlign = 'right'
		div.style.width = this.select.offsetWidth + 'px'
		if (this.options.order == 'user') {
			this.upButton = view.toolButton({icon: '/images/ico/up.gif', disabled: this.disabled})
			this.downButton = view.toolButton({icon: '/images/ico/down.gif', disabled: this.disabled})
			this.upButton.style.cssFloat = 'left'
			this.downButton.style.cssFloat = 'left'
			div.appendChild(this.upButton)
			div.appendChild(this.downButton)
			if (!this.disabled) {
                Event.observe(this.upButton, 'click', this.onClickUpButton.bind(this))
                Event.observe(this.downButton, 'click', this.onClickDownButton.bind(this))
            }
		}
		this.delButton = view.toolButton({icon: '/images/ico/delete.gif', disabled: this.disabled})
		this.addButton = view.toolButton({icon: '/images/ico/add.gif', disabled: this.disabled})
		if (!this.disabled) {
            Event.observe(this.delButton, 'click', this.onClickDelButton.bind(this))
            Event.observe(this.addButton, 'mouseover', function() {
                var position = Element.cumulativeOffset(this.addButton)
                Element.setStyle(this.iframe, {
					width: this.addButton.offsetWidth + 'px',
					height: this.addButton.offsetHeight + 'px',
					left: position[0] + 'px',
					top: position[1] + 'px'
				})
				Element.show(this.iframe)
            }.bind(this))
        }
		div.appendChild(this.delButton)
		div.appendChild(this.addButton)
		Element.insertAfter(div, this.select)
		
		if (!this.disabled) {
			this.iframe = new Element('iframe', {src: 'about:blank'})
			this.iframe.frameBorder = 0 //para el IE
			this.iframe.scrolling = 'no' //para el IE
			Element.setStyle(this.iframe, {
				position: 'absolute',
				zIndex: 99,
				left: 0,
				top: 0,
				overflow: 'hidden',
				border: 'none',
				display: 'none'
			})
			Element.setOpacity(this.iframe, 0)
			//Element.insertAfter(this.iframe, this.select)
			document.body.appendChild(this.iframe)
			this.iframe.onmouseout = function() { Element.hide(this.iframe) }.bind(this)
			this.drawForm()
			this.updateButtons()
			Event.observe(this.select.form, 'submit', this.onSubmitForm.bind(this))
		}
	},
	
	drawForm: function() {
		var document = this.iframe.contentWindow.document
		if (!document.body) {
			setTimeout(this.drawForm, 100)
			return
		}
		document.open()
		document.write('<html><head></head><body style="margin: 0; padding: 0; height: 100%"><form style="position: absolute; margin: 0; padding: 0; right: 0; top: 0; height: 100%" action="/attachments/upload/' + this.model + '/' + this.attachment + '" enctype="multipart/form-data" method="post"><fieldset style="margin: 0; border: none; padding: 0"><input type="hidden" name="authenticity_token" value="' + controller.authenticity_token + '" /><input name="file" type="file" style="height: 100px" /></fieldset></form></body></html>')
		document.close()
		this.initForm()
	},
	
	initForm: function() {
		var document = this.iframe.contentWindow.document
		if (!document.body) {
			setTimeout(this.initForm, 100)
			return
		}
		var input = document.getElementsByTagName('input')[1]
		Event.observe(input, 'mousedown', function() { this.addButton.style.borderStyle = 'inset' }.bind(this))
		var onMouseOut = function() { this.addButton.style.borderStyle = '' }.bind(this)
		Event.observe(input, 'mouseout', onMouseOut)
		Event.observe(input, 'mouseup', onMouseOut)
		Event.observe(input, 'change', function(event) {
			Event.element(event || window.event).form.submit()
        }.bind(this))
	},
	
    uploadCompleted: function(json) {
		if (json.result) {
			this.addOptions([[json.name, json.tmp_id]])
		} else {
			alert(json.message)
		}
		this.drawForm()
    },
	
	onClickUpButton: function() {
		this.moveSelectedOptionsUp()
	},
	
	onClickDownButton: function() {
		this.moveSelectedOptionsDown()
	},
	
	onClickDelButton: function() {
		if (confirm('¿Estás seguro?')) this.removeSelectedOptions()
	},
	
	addOptions: function(pairs) {
		var position
		switch (this.options.order) {
			case 'alpha':
				var optionsList = []
				for (var i = 0; i < this.select.options.length; i++) {
					optionsList.push(this.select.options[i].text.toLowerCase())
				}
				break
			case 'user':
				position = this.select.selectedIndex == -1 ? this.select.options.length : this.select.selectedIndex
				this.select.selectedIndex = -1
				break
			default:
				position = this.select.options.length
				this.select.selectedIndex = -1
		}
		pairs.each(function(pair) {
			var option = new Option(pair[0], pair[1])
			option.selected = true
			if (this.options.order == 'alpha') {
				optionsList.push(pair[0].toLowerCase())
				optionsList = optionsList.sort()
				position = optionsList.indexOf(pair[0].toLowerCase())
			}
			this.select.add(option, Prototype.Browser.IE ? position : this.select.options[position])
			position++
		}.bind(this))
		this.updateButtons()
	},
	
	removeSelectedOptions: function() {
		for (var i = 0; i < this.select.options.length; ) {
			if (this.select.options[i].selected) {
				this.select.removeChild(this.select.options[i])
				if (this.select.selectedIndex == -1) break
			} else {
				i++
			}
		}
		if (this.select.options.length) {
			this.select.options[i] || i--
			this.select.selectedIndex = i
		}
		this.updateButtons()
	},
	
	moveSelectedOptionsUp: function() {
		for (var i = this.select.selectedIndex; i < this.select.options.length; i++) {
			if (this.select.options[i].selected) {
				var option = new Option(this.select.options[i].text, this.select.options[i].value)
				option.selected = true
				this.select.add(option, Prototype.Browser.IE ? i - 1 : this.select.options[i - 1])
				this.select.removeChild(this.select.options[i + 1])
			}
		}
		this.updateButtons()
	},
	
	moveSelectedOptionsDown: function() {
		for (var i = this.select.options.length - 1; i > -1; i--) {
			if (this.select.options[i].selected) {
				var option = new Option(this.select.options[i].text, this.select.options[i].value)
				option.selected = true
				this.select.add(option, Prototype.Browser.IE ? i + 2 : this.select.options[i + 2])
				this.select.removeChild(this.select.options[i])
			}
		}
		this.updateButtons()
	},
	
	updateButtons: function() {
		if (this.options.order == 'user') {
			Element[(this.select.selectedIndex > 0 ? 'en' : 'dis') + 'able'](this.upButton)
			Element[(this.select.selectedIndex > -1 && !this.select.options[this.select.options.length - 1].selected ? 'en' : 'dis') + 'able'](this.downButton)
		}
		Element[(this.select.selectedIndex > -1 ? 'en' : 'dis') + 'able'](this.delButton)
		var max = typeof(this.options.amount) == 'object' ? this.options.amount.max : this.options.amount
		Element[(this.select.options.length < max ? 'en' : 'dis') + 'able'](this.addButton)
	},
	
	onSubmitForm: function() {
		for (var i = 0; i < this.select.options.length; i++) {
			this.select.options[i].selected = true
		}
	}
})
View.Controls.Box = function () {
	var bar, content, opened
	var effect = 'blind'
	var options = {duration: 0.4}
	
	this.initialize = function() {
		bar = arguments[0]
		content = bar.nextSibling
		while (content.nodeType && content.nodeType != 1) {
			content = content.nextSibling
		}
		if (content.nodeType != 1) {
			trown('content element not found in DOM for box')
		}
		Element.hide(arguments[1] ? bar : content)
		Event.observe(bar, 'click', this.toggle.bind(this))
		//Event.observe(content, 'click', this.toggle.bind(this))
	}
	
	this.toggle = function() {
		Element.toggle(bar)
		Element.toggle(content)
		return
		if (Element.visible(content)) {
			options.scaleTo = 5
		}
		new Effect.toggle(bar, effect, options)
		new Effect.toggle(bar, effect, options)
		new Effect.toggle(bar, effect, options)
		new Effect.toggle(bar, effect, options)
		//new Effect.toggle(content, effect, options)
	}
	
	this.initialize.apply(this, arguments)
}
View.Controls.CrossSelect = Class.create({
	availableSelect: null,
	selectedSelect: null,
	addButton: null,
	delButton: null,
	
	initialize: function(select) {
		this.availableSelect = typeof(select) == 'string' ? document.getElementById(select) || document.getElementsByName(select)[0] : select
        this.disabled = this.availableSelect.disabled
		this.selectedSelect = this.availableSelect.cloneNode(false)
		this.selectedSelect.removeAttribute('name')
		if (this.availableSelect.selectedIndex > -1) {
			this.addItems(this.availableSelect, this.selectedSelect)
			this.availableSelect.selectedIndex = -1
			this.selectedSelect.selectedIndex = -1
		}
		this.addButton = view.toolButton({icon: '/images/ico/move-in.gif', caption: _('Add')})
		this.delButton = view.toolButton({icon: '/images/ico/move-out.gif', caption: _('Remove')})
        if (!this.disabled) {
            Event.observe(this.addButton, 'click', this.onAddItems.bind(this))
            Event.observe(this.delButton, 'click', this.onDelItems.bind(this))

            //Prototype library overwrites HTMLSelectElement.remove() native method
            var availableSelectRemove = this.availableSelect.remove
            var selectedSelectRemove = this.selectedSelect.remove

            Event.observe(this.availableSelect, 'dblclick', this.onAddItems.bind(this))
            Event.observe(this.selectedSelect, 'dblclick', this.onDelItems.bind(this))

            Event.observe(this.availableSelect, 'change', this.update.bind(this))
            Event.observe(this.selectedSelect, 'change', this.update.bind(this))
            //restore HTMLSelectElement.remove() native method
            this.availableSelect.remove = availableSelectRemove
            this.selectedSelect.remove = selectedSelectRemove

            Event.observe(this.availableSelect.form, 'submit', this.onSubmitForm.bind(this))
        }
	},
	
	//event handlers
	
	onAddItems: function() {
		this.addItems(this.availableSelect, this.selectedSelect)
	},
	
	onDelItems: function() {
		this.delItems(this.selectedSelect)
	},
	
	
	onSubmitForm: function() {
		this.availableSelect.selectedIndex = -1
		if (this.selectedSelect.options.length) {
			var selecteds = {}
			for (var i = 0; i < this.selectedSelect.options.length; i++) {
				if (this.selectedSelect.options[i].className == 'red') {
					selecteds[this.selectedSelect.options[i].value] = true
				}
			}
			for (var i = 0; i < this.availableSelect.options.length; i++) {
				if (selecteds[this.availableSelect.options[i].value]) {
					this.availableSelect.options[i].selected = true
				}
			}
		}
	},
	
	addItems: function(from, to) {
		var changed = false
		to.selectedIndex = -1
		var path = []
		for (var i = 0; i < from.options.length; i++) {
			//prepare path
			var matches = from.options[i].text.match(/^([^a-z0-9]+)(.+)$/i)
			var pathLevel = matches[1].length / 2 - 1
			path[pathLevel] = {name: matches[2], text: from.options[i].text, value: from.options[i].value, 'class': from.options[i].className}
			if (pathLevel < path.length - 1) {
				path = path.slice(0, pathLevel + 1)
			}
			//is selected?
			if (from.options[i].selected) {
				//locate path in to
				var toIndex = 0
				var newToIndex = 0
				for (pathLevel = 0; pathLevel < path.length; pathLevel++) {
					var exists = false
					var list = [path[pathLevel].name.toLowerCase()]
					for(; toIndex < to.options.length; toIndex++) {
						if (to.options[toIndex].value == path[pathLevel].value) {
							exists = true
							toIndex++
							break
						}
						var matches = to.options[toIndex].text.match(/^([^a-z0-9]+)(.+)$/i)
						var toLevel = matches[1].length / 2 - 1
						if (toLevel == pathLevel) {
							list.push(matches[2].toLowerCase())
							list.sort()
							if (list[list.length - 1] != path[pathLevel].name.toLowerCase()) {
								break
							}
						} else if(toLevel < pathLevel) {
							break
						}
					}
					if(!exists) {
						break
					}
				}
				//already exists this option in to?
				if (exists) {
					if (to.options[toIndex - 1].className == 'red') {
						alert(_('Item %s already is added').sprintf(path[path.length - 1].name))
						continue
					} else {
						to.options[toIndex - 1].className = 'red'
						to.options[toIndex - 1].selected = true
						changed = true
					}
				//create new path in to
				} else {
					for(; pathLevel < path.length; pathLevel++) {
						var newOption = new Option(path[pathLevel].text, path[pathLevel].value)
						if (path[pathLevel]['class'] == 'grey') {
							newOption.className = 'grey'
						} else if (pathLevel == path.length - 1) {
							newOption.className = 'red'
							newOption.selected = true
						} else {
							 newOption.className = 'grey'
						}
						to.add(newOption, to.options.length ? (Prototype.Browser.IE ? toIndex : to.options[toIndex]) : undefined)
						//to.options.length ? to.add(newOption, Prototype.Browser.IE ? toIndex : to.options[toIndex]) : to.add(newOption, null)
						toIndex++
					}
					changed = true
				}
			}
		}
		if (changed) {
			this.redrawFlowLines(to)
			Event.fire(to, 'change')
		}
	},
	
	delItems: function(select) {
		var path = []
		for (var i = 0; i < select.options.length;) {
			//prepare path
			var matches = select.options[i].text.match(/^([^a-z0-9]+)(.+)$/i)
			var pathLevel = matches[1].length / 2 - 1
			path[pathLevel] = i
			if (pathLevel < path.length-1) {
				path = path.slice(0, pathLevel + 1)
			}
			//is selected?
			if (select.options[i].selected) {
				var lastI = i
				//has childs?
				if (select.options[i + 1] && select.options[i + 1].text.match(/^([^a-z0-9]+).+$/i)[1].length / 2 - 1 > pathLevel) {
					select.options[i].className = 'grey'
					i++
					continue
				} else {
					select.remove(i)
				}
				//remove parents?
				for (var pathLevel = path.length - 2; pathLevel > -1; pathLevel--) {
					if (select.options[path[pathLevel] + 1] && select.options[path[pathLevel] + 1].text.match(/^([^a-z0-9]+).+$/i)[1].length / 2 - 1 > pathLevel) {
						break
					} else if(select.options[path[pathLevel]].className == 'grey') {
						select.remove(path[pathLevel])
						lastI = path[pathLevel]
						i--
					}
				}
			} else {
				i++
			}
		}
		//next selected
		if (select.options.length) {
			select.selectedIndex = -1
			if (select.options[lastI]) {
				while (select.options[lastI] && select.options[lastI].className == 'grey') {
					lastI++
				}
			}
			if (!select.options[lastI]) {
				do {
					lastI--
				} while(select.options[lastI] && select.options[lastI].className == 'grey')
			}
			if (select.options[lastI]) {
				select.options[lastI].selected = true
			}
		}
		this.redrawFlowLines(select)
		Event.fire(select, 'change')
	},
	
	update: function() {
		Element[(this.availableSelect.selectedIndex > -1 ? 'en' : 'dis') + 'able'](this.addButton)
		if (this.selectedSelect.selectedIndex > -1) {
			for (var i = this.selectedSelect.selectedIndex; i < this.selectedSelect.options.length; i++) {
				if (this.selectedSelect.options[i].selected && this.selectedSelect.options[i].className == 'grey') {
					this.selectedSelect.options[i].selected = false
				}
			}
		} 
		Element[(this.selectedSelect.selectedIndex > -1 ? 'en' : 'dis') + 'able'](this.delButton)
	},

	redrawFlowLines: function(select) {
		var flowLines = []
		for (var index = select.options.length - 1; index > -1; index--) {
			var matches	= select.options[index].text.match(/^([^a-z0-9]+)(.+)$/i)
			var level = matches[1].length / 2 - 1
			if (level < flowLines.length - 1) {
				flowLines = flowLines.slice(0, level + 1)
			}
			flowLines[level] = true
			if (level) {
				text = '&nbsp;&nbsp;'
				for (var j = 1; j < flowLines.length - 1; j++) {
					text += flowLines[j] ? '|&nbsp;' : '&nbsp;&nbsp;'
				}
				text += '|-' + matches[2]
				if (select.options[index].text != text) {
					select.options[index].innerHTML = text
				}
			}
		}
	}
})
View.Controls.Form = Class.create({
	form: null,
	
	initialize: function(form, ctrlKey) {
		this.form = form
		form.validator = new Validator(form)
		var creating = form.action.match(/\d$/) ? false : true
		var next = true
		//navigation bar
		var anchors = $$('.navBar a')
		if (anchors.length) {
			next = anchors[1].href.match(/\/([0-9]+)$/)
			next = next ? next[1] : false
			var button = view.anchorToButton(anchors[0], {icon: '/images/ico/previous.gif'})
			button.onclick = this.onClickNavButton.bind(this, anchors[0].href)
			button = view.anchorToButton(anchors[1], {icon: '/images/ico/next.gif', order: ['caption', 'icon']})
			button.onclick = this.onClickNavButton.bind(this, anchors[1].href)
		}
		//cancel button
		var cancelButton = $('cancel')
		if (cancelButton) cancelButton = view.anchorToButton(cancelButton, {icon: '/images/ico/cancel.gif'})
		//submit button
		var submitButton = Element.select(form, 'button[type="submit"]')[0]
		//delete button
        var delForm = document.forms['delete']
        if (delForm) {
            delForm.style.display = 'none'
            var delButton = delForm.getElementsByTagName('button')[0]
            delButton.parentNode.removeChild(delButton)
            delButton.setAttribute('type', 'button')
            Event.observe(delButton, 'click', function(event) {
                event = event || window.event
                if (confirm(_('Are you sure of DELETE this item?'))) {
                    view.waitLayer.show(_("Deleting item ...\nPlease, wait."))
                    if (event.ctrlKey) {
                        var input = document.createElement('input')
                        input.type = 'hidden'
                        input.name = 'next'
                        input.value = next
                        delForm.appendChild(input)
                        if (form.tabs.active() > 1) {
                            var input = document.createElement('input')
                            input.type = 'hidden'
                            input.name = 'tab'
                            input.value = form.tabs.active()
                            delForm.appendChild(input)
                        }
                    }
                    delForm.submit()
                }
            })
            //Element.insertAfter(delButton, Element.select(form, 'fieldset.buttons button')[0])
            var textNode = document.createTextNode(' ')
            submitButton.parentNode.insertBefore(textNode, submitButton)
            submitButton.parentNode.insertBefore(delButton, textNode)
        }
		if (controller.action != 'read') {
            if (ctrlKey) {
                Event.observe(document, 'keydown', function(event) {
                    event = event || window.event
                    if (event.keyCode == 17 && !form.ctrlKey) {
                        form.ctrlKey = true
                        if (controller.action == 'create') {
                            submitButton.lastChild.nodeValue = ' ' + _('Create and new')
                        } else {
                            submitButton.lastChild.nodeValue = ' ' + _('Update and next')
                            delButton.lastChild.nodeValue = ' ' + _('Delete and next')
                            if (next) {
                                form.next = next
                            } else {
                                Element.disable(submitButton)
                                Element.disable(delButton)
                            }
                        }
                    }
                })
                Event.observe(document, 'keyup', function() {
                    if (form.ctrlKey) {
                        form.ctrlKey = undefined
                        if (controller.action == 'create') {
                            submitButton.lastChild.nodeValue = ' ' + _('Create')
                        } else {
                            Element.enable(submitButton)
                            Element.enable(delButton)
                            submitButton.lastChild.nodeValue = ' ' + _('Update')
                            delButton.lastChild.nodeValue = ' ' + _('Delete')
                        }
                    }
                })
            }
            Event.observe(form, 'submit', function(event) {
                if (form.ctrlKey) {
                    var input = document.createElement('input')
                    input.type = 'hidden'
                    input.name = 'next'
                    input.value = next
                    form.appendChild(input)
                    if (form.tabs.active() > 1) {
                        var input = document.createElement('input')
                        input.type = 'hidden'
                        input.name = 'tab'
                        input.value = form.tabs.active()
                        form.appendChild(input)
                    }
                }
            })
        }
		//tabs
		form.tabs = new View.Controls.Tabs(form)
		var tab = location.href.match(/tab=(\d+)/)
		if (tab) this.form.tabs.activate(tab[1])
	},
	
	onClickNavButton: function(href) {
		var active = this.form.tabs.getActive()
		window.location = href + (active > 1 ? '?tab=' + active : '')
	}
})
View.Controls.GoogleMap = {
	DEFAULT_LATITUDE: 40.463667,
	DEFAULT_LONGITUDE: -3.74922	
}
View.Controls.Hierarchicable = {
	addNode: function(node, parent, position) {
		position = this.getAbsolutePosition(parent, position == 'alpha' ? this.getText(node) : position)
		var select = this.getSelect(parent)
		try { select.add(node, select.options[position]) } catch (e) { select.add(node, position) }
		this.redraw(node, this.getLevel(parent) + 1)
		if (position > 0) this.redrawToRoot(select.options[position - 1])
		return node
	},
	
	moveNode: function(node, deep, parent, position) {
		if (deep) {
			//if (position > bounds.top && position <= bounds.bottom) throw("New position '" + position + "' can't be between the tree bounds " + $H(bounds).inspect())
			var nodes = []
			var select = this.getSelect(node)
			var bounds = this.getTreeBounds(node)
			for (var i = bounds.bottom; i >= bounds.top; i--) {
				nodes.push(select.options[i])
				select.remove(i)
			}
			if (i > 0) this.redrawToRoot(select.options[i])
			var position = this.getAbsolutePosition(parent, position == 'alpha' ? this.getText(node) : position)
			var levelDiff = this.getLevel(parent) - (this.getLevel(node) - 1)
			select = this.getSelect(parent)
			for (var i = 0; i < nodes.length; i++) {
				position < select.childNodes.length ? select.insertBefore(nodes[i], select.childNodes[position]) : select.appendChild(nodes[i])
				this.redraw(nodes[i], this.getLevel(select.options[position]) + levelDiff)
			}
			node = nodes[i - 1]
			if (position) this.redrawToRoot(select.options[position - 1])
		} else {
			this.removeNode(node)
			var position = this.getAbsolutePosition(parent, position == 'alpha' ? this.getText(node) : position)
			var select = this.getSelect(parent)
			position < select.childNodes.length ? select.insertBefore(node, select.childNodes[position]) : select.appendChild(node)
			this.redraw(node, this.getLevel(parent) + 1)
		}
		return node
	},

	removeNode: function(node, deep) {
		var select = this.getSelect(node)
		var bounds = this.getTreeBounds(node)
		if (deep) {
			for (var i = bounds.bottom; i >= bounds.top; i--) {
				select.remove(i)
			}
		} else {
			select.remove(node.index)
			for (var i = bounds.bottom; i > bounds.top; i--) {
				this.redraw(select.options[i], this.getLevel(select.options[i]) - 1)
			}
		}
	},
	
	// Returns the select element to witch belongs the node
	getSelect: function(node) {
		switch (node.tagName.toLowerCase()) {
			case 'option':
				return node.parentNode
			case 'select':
				return node
			default:
				throw('Invalid parent ' + $H(parent).inspect())
		}
	},
	
	// Returns the parent of a node
	getParent: function(node) {
		var select = this.getSelect(node)
		if (select == node) return node
		var myLevel = this.getLevel(node)
		for (var i = node.index - 1; i > -1; i--) {
			var level = this.getLevel(select.options[i])
			if (level < myLevel) {
				return select.options[i]
			}
		}
		return select
	},
	
	// Returns an array with the ancestors of a node in reverse order (direct parent is the first item in the array)
	getAncestors: function(option) {
		var ancestors = []
		var select = option.parentNode
		var myLevel = this.getLevel(option)
		for (var i = option.index - 1; i > -1; i--) {
			var level = this.getLevel(select.options[i])
			if (level < myLevel) {
				ancestors.push(select.options[i])
				myLevel = level
			}
		}
	},
	
	// Returns an array with the children of a node
	getChildren: function(parent) {
		var select = this.getSelect(parent)
		var children = []
		var parentLevel = this.getLevel(parent)
		for (var i = ('index' in parent ? parent.index : -1) + 1; i < select.options.length; i++) {
			var level = this.getLevel(select.options[i])
			if (level == parentLevel + 1) {
				children.push(select.options[i])
			} else if (level <= parentLevel) {
				break
			}
		}
		return children
	},
	
	// Return the last descendant of a node or null if this not exist
	getLastDescendant: function(node) {
		var last = null
		var select = node.parentNode
		var parentLevel = this.getLevel(node)
		for (var i = node.index + 1; i < select.options.length; i++) {
			var level = this.getLevel(select.options[i])
			if (level > parentLevel) {
				last = select.options[i]
			} else if (level <= parentLevel) {
				break
			}
		}
		return last
	},
	
	// Redraws the flow lines of a node
	// Optionalment level can be specified
	redraw: function(option, level) {
		var flowLines = ''
		if (level == undefined) level = this.getLevel(option)
		if (level == 0) {
			flowLines = '• '
		} else if (level == 1) {
			flowLines = '  |-'
		} else {
			var next = option.parentNode.options[option.index + 1]
			if (next) {
				var nextLevel = this.getLevel(next)
				if (nextLevel) {
					var to = level <= nextLevel ? (level + 1) * 2 - 2 : (nextLevel + 1) * 2
					for (var i = 0; i < to; i = i + 2) {
						switch (next.text.substr(i, 2)) {
							case '\xa0\xa0':
								flowLines += '  '
								break
							case '|\xa0':
							case '|-':
								flowLines += '| '
								break
							default:
								throw("Unexpected flow line '" + next.text.substr(i, 2) + "'")
						}
					}
					if (level <= nextLevel) {
						flowLines += '|-'
					} else {
						flowLines = flowLines + ('|-').rjust((level + 1) * 2 - flowLines.length)
					}
				}
			}
		}
		if (!flowLines) flowLines = '|-'.rjust((level + 1) * 2)
		option.innerHTML = flowLines.replace(/\s/g, '&nbsp;') + this.getText(option)
	},
	
	// Redraws a node and her previous nodes up to root
	redrawToRoot: function(node) {
		var select = node.parentNode
		for (var i = node.index; i >= 0; i--) {
			var level = this.getLevel(select.options[i])
			switch (level) {
				case 0:
					i = -1
					break
				case 1:
					i = -1
					break
				default:
					this.redraw(select.options[i], level)
			}
		}
	},
	
	// Return the first and last index of a tree
	getTreeBounds: function(parent) {
		var lastDescendant = this.getLastDescendant(parent)
		return {top: parent.index, bottom: lastDescendant ? lastDescendant.index : parent.index}
	},
	
	getPositionAsChild: function(node) {
		var children = this.getChildren(this.getParent(node))
		for (var i = 0; i < children.length; i++) {
			if (children[i] == node) return i
		}
		return 0
	},
	
	// Traslates a child position to select.options index
	getAbsolutePosition: function(parent, position) {
		var children = this.getChildren(parent)
		if (position == undefined) position = children.length
		switch (typeof(position)) {
			case 'string':
				if (children.length) {
					var list = children.collect(function(o) { return this.getText(o).toLowerCase() }.bind(this))
					var lowerCaseText = position.toLowerCase()
					list.push(lowerCaseText)
					list.sort()
					position = list.indexOf(lowerCaseText)
					position = position == 0 ? ('index' in parent ? parent.index + 1 : 0) : this.getTreeBounds(children[position - 1]).bottom + 1
				} else {
					position = 'index' in parent ? parent.index + 1 : 0
				}
				break
			case 'number':
				if (position > children.length) throw('Position ' + position + ' out of bounds')
				if (children.length) {
					position = position < children.length ? children[position].index : this.getTreeBounds(children[position - 1]).bottom + 1
				} else {
					position = 'index' in parent ? parent.index + 1 : 0
				}
				break
			default:
				throw('Invalid position type ' + typeof(position))
		}
		return position
	},
	
	// Returns text without the flow lines
	getText: function(option) {
		var text = option.text.match(/(?:[\s|]+\|-|^•\s)(.*)$/)
		return text ? text[1] : option.text
	},
	
	// Sets the text without affecting flow lines
	setText: function(option, text) {
		option.text = option.text.replace(/([\s|]+\|-|^•\s).*$/, '$1' + text)
	},
	
	// Returns the level of a node
	getLevel: function(node) {
		if ('selectedIndex' in node) {
			return -1
		} else if (node.text.charAt(0) == '•') {
			return 0
		} else {
			var flowLines = node.text.match(/^(?:\s\s|\|\s)+\|-/)[0]
			if (!flowLines) throw("Can't resolve the level of " + option.text)
			return flowLines.length / 2 - 1
		}
	},
	
	previousSibling: function(node) {
		var children = this.getChildren(this.getParent(node))
		for (var i = 0; i < children.length; i++) {
			if (children[i] == node) return i > 0 ? children[i - 1] : null
		}
	},
	
	nextSibling: function(node) {
		var children = this.getChildren(this.getParent(node))
		for (var i = 0; i < children.length; i++) {
			if (children[i] == node) return i + 1 in children ? children[i + 1] : null
		}
	}
}
// http://www.huddletogether.com/projects/lightbox2/#download
View.Controls.ImageGallery = Class.create({
	/*
	this.images = [{
		index: //indice
		source: //imagen en el artículo
		container: //div donde va la imagen grande
		destination: //imagen en la galeria
		thumbnail: //miniatura en el scroller
	}]
	this.active = 0 //indice de la imagen activa
	this.description //div de la descripcion
	*/
	initialize: function(imgs) {
		this.onViewportChange = this.onViewportChange.bind(this)
		this.onKeyDown = this.onKeyDown.bind(this)
		this.onMouseMove = this.onMouseMove.bind(this)
		this.onMouseUp = this.onMouseUp.bind(this)
		
		this.images = []
		for (var i = 0, l = imgs.length; i < l; i++) {
			var img = imgs[i]
			Event.observe(img, 'click', this.onClickImg.bind(this, i))
			this.images.push({index: i, source: img})
		}
	},
	
	onClickImg: function(index) {
		this.show(index)
	},
	
	show: function(index) {
		//eliminamos scroll
		var style = document.body.parentNode.style
        this.overflow = style.overflow
        style.overflow = 'hidden'
		//ocultar selects y objetos embebidos
		$$('select', 'object', 'embed').each(function(e) { e.style.visibility = 'hidden' })
		//construimos
		this.build()
		//colocamos y mostramos
		this.place()
		//mostramos div, pero con transparencia 0 para poder posicionar las imagenes
		Element.setOpacity(this.div, 0)
		this.div.style.display = 'block'
		Effect.Appear(this.div, {duration: 0.25})
		//mostramos imagen seleccionada
		this.goTo(index)		
		//por si el usuario cambia dimensiones del navegador o hace scroll
		Event.observe(window, 'resize', this.onViewportChange)
		Event.observe(window, 'scroll', this.onViewportChange)
		//atajos de teclado
		Event.observe(document, 'keydown', this.onKeyDown)
	},
	
	build: function() {
		if (this.div) return
		this.div = new Element('div', {'class': 'imageGallery'})
		//div del fondo
		var div = new Element('div', {'class': 'background'})
		Element.setOpacity(div, 0.6)
		Event.observe(div, 'click', function() { this.hide() }.bind(this))
		this.div.appendChild(div)
		//viewer
		var viewer = this.viewer = new Element('div', {'class': 'viewer'})
		this.div.appendChild(viewer)
		//scroller
		var scroller = this.scroller = new Element('div', {'class': 'scroller'})
		this.div.appendChild(scroller)
		//imagenes
		for (var i = 0, l = this.images.length; i < l; i++) {
			var image = this.images[i]
			//contenedor
			div = new Element('div', {'class': 'container'})
			viewer.appendChild(div)
			div.style.display = 'none'
			image.container = div
			//miniatura
			var thumbnail = new Element('div', {'class': 'thumbnail'})
			div = new Element('div')
			var img = new Element('img', {src: image.source.src})
			var dimensions = image.source.getDimensions()
			if (dimensions.width > dimensions.height) {
				img.style.height = '50px'
				//centrar horizontalmente
			} else {
				img.style.width = '50px'
				//centrar verticalmente
			}
			div.appendChild(img)
			thumbnail.appendChild(div)
			thumbnail.onclick = function(idx) { this.goTo(idx) }.bind(this, image.index)
			image.thumbnail = thumbnail
			scroller.appendChild(thumbnail)
		}
		//descripcion
		div = new Element('div', {'class': 'description'})
		Element.setOpacity(div, 0.6)
		viewer.appendChild(div)
		this.description = new Element('p')
		viewer.appendChild(this.description)
		//botones
		var onMouseOver = function(event) {
			var div = Event.element(event || window.event)
			if (!div.disabled) Element.setOpacity(div, 1)
		}
		var onMouseOut = function(event) { Element.setOpacity(Event.element(event || window.event), 0.6)}
		div = new Element('div', {'class': 'close'})
		Element.setOpacity(div, 0.6)
		div.onmouseover = onMouseOver
		div.onmouseout = onMouseOut
		div.onclick = this.hide.bind(this)
		viewer.appendChild(div)
		div = new Element('div', {'class': 'left'})
		Element.setOpacity(div, 0.6)
		div.onmouseover = onMouseOver
		div.onmouseout = onMouseOut
		div.onclick = this.previous.bind(this)
		viewer.appendChild(div)
		this.left = div
		div = new Element('div', {'class': 'right'})
		Element.setOpacity(div, 0.6)
		div.onmouseover = onMouseOver
		div.onmouseout = onMouseOut
		div.onclick = this.next.bind(this)
		viewer.appendChild(div)
		this.right = div
		document.body.appendChild(this.div)
	},
	
	place: function() {
		var scroll = document.viewport.getScrollOffsets()
		var viewport = document.viewport.getDimensions()
        Element.setStyle(this.div, {
			left: scroll.left + 'px',
			top: scroll.top + 'px',
			width: viewport.width + 'px',
			height: viewport.height + 'px'
        })
		if (this.active !== undefined) {
			var image = this.images[this.active]
			this.centerImage(image)
			this.calcDragLimits(image)
		}
	},
	
	centerImage: function(image) {
		var container = image.container.parentNode, img = image.destination
		img.style.left = Math.round((container.offsetWidth - img.width) / 2) + 'px'
		img.style.top = Math.round((container.offsetHeight - img.height - 55) / 2) + 'px'
	},
	
	calcDragLimits: function(image) {
		var container = image.container.parentNode, img = image.destination
		var minX = img.width > container.offsetWidth ? container.offsetWidth - img.width : 0
		var minY = img.height > container.offsetHeight - 55 ? container.offsetHeight - img.height - 55 : 0 //55 es la altura de la caja de descripción
		image.drag = {
			minX: minX,
			minY: minY
		}
		img.style.cursor = minX < 0 || minY < 0 ? 'move' : 'default'
	},
	
	previous: function() {
		if (this.images[this.active - 1]) this.goTo(this.active - 1)
	},
	
	next: function() {
		if (this.images[this.active + 1]) this.goTo(this.active + 1)
	},
	
	goTo: function(index) {
		if (index == this.index) return
		var image = this.images[index]
		this.active = index
		var loaded = this.loadImage(0)
		//titulo y descripcion
		var html = '<strong>' + (image.source.title || image.source.src.match(/\/([^\.\/]+)\.[^\/]+$/)[1]) + '</strong>'
		if (image.source.alt) html += '<br>' + image.source.alt
		this.description.innerHTML = html
		//imagen
		for (var i = 0, l = this.images.length; i < l; i++) {
			var _image = this.images[i]
			if (_image.index == index) {
				_image.container.style.display = 'block'
				Element.addClassName(_image.thumbnail, 'active')
			} else {
				_image.container.style.display = 'none'
				Element.removeClassName(_image.thumbnail, 'active')
			}
		}
		this.centerImage(image)
		this.calcDragLimits(image)
		//botones
		if (this.images[index - 1]) {
			this.left.disabled = false
		} else {
			this.left.disabled = true
			Element.setOpacity(this.left, 0.6)
		}
		if (this.images[index + 1]) {
			this.right.disabled = false
		} else {
			this.right.disabled = true
			Element.setOpacity(this.right, 0.6)
		}
	},
	
	loadImage: function(relative) {
		var image = this.images[this.active + relative]
		if (!image || image.destination) { //pasamos al siguiente si relative apunta fuera de los limites o la imagen ya está cargada
			switch (relative) {
				case 0:
					this.loadImage(1)
					break
				case 1:
					this.loadImage(-1)
			}
			return false
		}
		//cargando
		Element.addClassName(image.container, 'loading')
		//creamos imagen
		var img = new Element('img')
		image.destination = img
		img.onload = function(image) {
			image.container.appendChild(image.destination)
			Element.removeClassName(image.container, 'loading')
			switch (relative) {
				case 0:
					this.centerImage(image)
					this.calcDragLimits(image)
					this.loadImage(1)
					break
				case 1:
					this.loadImage(-1)
			}
		}.bind(this, image)
		var id = image.source.src.split('.')
		img.src = '/attachments/show/a' + parseInt(id[id.length - 3], 36) + '.png'
		//eventos para arrastrar
		img.onmousedown = function(image, e) {
			var event = window.event || e
			//alert($H(window.event).inspect())
			//alert($H(event).inspect())
			var offset = Element.cumulativeOffset(image.container)
			var img = image.destination
			img.dragging = {
				container: {x: offset.left, y: offset.top},
				image: {x: img.offsetLeft, y: img.offsetTop},
				anchor: {x: event.clientX - offset.left, y: event.clientY - offset.top}
			}
			//Event.observe(view.browser.ie ? document : window, 'mousemove', this.onMouseMove)
			Event.observe(document.all ? document : window, 'mouseup', this.onMouseUp) //ie no tiene eventos de raton en window
			Event.stop(event)
		}.bind(this, image)
		return true
	},
	
	onMouseMove: function(e) {
		var event = window.event || e
		var image = this.images[this.active]
		var img = image.destination
		//img.title += '-' + event.clientX
		if (!img.dragging) return
		var minX = image.drag.minX, minY = image.drag.minY
		if (minX < 0) {
			var left = img.dragging.image.x - (img.dragging.anchor.x - (event.clientX - img.dragging.container.x))
			if (left < minX) left = minX
			else if (left > 0) left = 0
			img.style.left = left + 'px'
		}
		if (minY < 0) {
			var top = img.dragging.image.y - (img.dragging.anchor.y - (event.clientY - img.dragging.container.y))
			if (top < minY) top = minY
			else if (top > 0) top = 0
			img.style.top = top + 'px'
		}
	},
	
	onMouseUp: function(e) {
		var event = window.event || e
		alert($H(event).inspect())
		var image = this.images[this.active]
		//image.destination.title += '-onMouseUp'
		image.destination.dragging = false
		Event.stopObserving(window, 'mousemove', this.onMouseMove)
		Event.stopObserving(window, 'mouseup', this.onMouseUp)
		//alert(event.clientX + ', ' + event.clientY)
	},
	
	hide: function() {
		//dejamos de escuchar
        Event.stopObserving(window, 'resize', this.onViewportChange)
		Event.stopObserving(window, 'scroll', this.onViewportChange)
		Event.stopObserving(document, 'keydown', this.onKeyDown)
		//ocultamos
		Effect.Fade(this.div, {
			duration: 0.25,
			afterFinish: function() {
				//restauramos scroll
				document.body.parentNode.style.overflow = this.overflow
				//fix para chrome, que no restaura las barras de scroll
				if (window.scrollY) {
					var y = scrollY
					scrollTo(scrollX, y + 1)
					scrollTo(scrollX, y)
				}
				//mostrar selects y objetos embebidos
				$$('select', 'object', 'embed').each(function(e) { e.style.visibility = 'visible' })
			}.bind(this)
		})
	},
	
    onViewportChange: function() {
        this.place()
    },
	
	onKeyDown: function(event) {
		var keycode = event.keyCode
		var escapeKey
		if (event.DOM_VK_ESCAPE) { // mozilla
			escapeKey = event.DOM_VK_ESCAPE
		} else { // ie
			escapeKey = 27
		}
		var key = String.fromCharCode(keycode).toLowerCase()
		if (key.match(/x|o|c/) || (keycode == escapeKey)) { // cerrar
			this.hide()
			Event.stop(event)
		} else if ((key == 'p') || (keycode == 37)) { // anterior
			this.previous()
			Event.stop(event)
		} else if ((key == 'n') || (keycode == 39) || (keycode == 32)) { // siguiente
			this.next()
			Event.stop(event)
		}
	}
})
/*
 * Listado de elementos del panel de control
 */
View.Controls.List = Class.create({
	delimitForm: null,
	delimitFormWasEmpty: null, //indica si el formulario estaba vacio originalmente
	delimitBox: null,
	deleteForm: null,
	
	initialize: function(container) {
		var forms = container.getElementsByTagName('form')
		//delimit form
		this.delimitForm = forms[0]
		this.setupDelimitForm()
		this.delimitFormWasEmpty = Form.isEmpty(this.delimitForm)
		//undelimit form
		Event.observe(forms[1], 'submit', this.onSubmitUndelimitForm.bind(this))
		//boxes
		var titleBars = container.getElementsByTagName('h1')
		this.delimitBox = new View.Controls.Box(titleBars[0], !this.delimitFormWasEmpty)
		new View.Controls.Box(titleBars[1])
		//tabla del listado
		var table = container.getElementsByTagName('table')[0]
		var cell = Element.select(table, 'th.updt')[0]
		if (cell) cell.style.display = 'none'
		var cell = Element.select(table, 'td.updt')
		for (var i = 0, l = cell.length; i < l; i++) {
			cell[i].style.display = 'none'
		}
		cell = Element.select(table, 'th.chk')[0]
		if (cell) Event.observe(cell, 'click', this.onClickSelectAllItems.bind(this))
		if (table.rows.length > 2 || table.rows[1].cells.length > 1) {
			var rows = table.tBodies[0].rows
			for (var i = 0, l = rows.length; i < l; i++) {
				Event.observe(rows[i], 'click', this.onClickItem.bind(this))
			}
		}
		//delete form
		this.deleteForm = forms[2]
		if (this.deleteForm) Event.observe(this.deleteForm, 'submit', this.onSubmitDeleteForm.bind(this))
		//convertimos el enlace create en un boton
		var node = document.getElementById('create')
		if (node) view.anchorToButton(node, {icon: '/images/ico/create.gif'})
		//options
		var onSubmit = function(e) { Event.element(e || window.event).form.submit() }
		var fieldset = Element.select(container, 'fieldset.options')[0]
		var field = Element.select(fieldset, 'input[name="highlight"]')[0]
		if (field) Event.observe(field, 'click', onSubmit)
		field = Element.select(fieldset, 'select[name="per_page"]')[0]
		Event.observe(field, 'change', onSubmit)
		Element.hide(Element.select(fieldset, 'button[type="submit"]')[0])
		//highlighted
		var highlighted = Element.select(table, 'tr.highlighted')[0]
		if (highlighted) view.highlighter.start(highlighted)
	},
	
	setupDelimitForm: function() {
		this.delimitForm.validator = new Validator(this.delimitForm)
		with (this.delimitForm) {
			validator.validates(term, 'Término', {filled: 'optional', length: {min: 3, max: 32}})
			Event.observe(term, 'keyup', this.onChangeTerm.bind(this))
			validator.validate()
		}
		this.onChangeTerm()
	},
	
	onSubmitUndelimitForm: function(event) {
		if (this.delimitFormWasEmpty) {
			Form.reset(this.delimitForm)
			this.onChangeTerm()
			this.delimitBox.toggle()
			Event.stop(event || window.event)
		}
	},
	
	onClickItem: function(event) {
		event = event || window.event
		var target = event.target || event.srcElement
		switch (target.tagName.toLowerCase()) {
			case 'input':
				switch (target.type) {
					case 'checkbox':
					case 'radio':
						return
				}
			case 'a':
				return
		}
		var tr = Element.up(target, 'tr')
		view.highlighter.start(tr)
		location.assign(tr.getElementsByTagName('A')[0].href)
	},
	
	onClickSelectAllItems: function() {
		var allChecked = true
		var elements = Form.getElements(this.deleteForm)
		elements.each(function(element) {
			if (!element.checked) {
				allChecked = false
				throw $break
			}
		})
		elements.each(function(element) {
			if (!element.disabled)
				element.checked = allChecked ? false : true
		})
	},
	
	onSubmitDeleteForm: function(event) {
		var checkeds = 0
		Form.getElements(this.deleteForm).each(function(element) {
			if (element.checked && !element.disabled) {
				checkeds++
			}
		})
		if (checkeds) {
			if (confirm('¿Confirmas el BORRADO de los ' + checkeds + ' elementos seleccionados?')) {
				return true
			}
		} else {
			alert('Selecciona los elementos que quieres BORRAR')
		}
		Event.stop(event || window.event)
	},
	
	onChangeTerm: function() {
		with (this.delimitForm) {
			if (term.value.strip()) {
				term.style.backgroundColor = ''
				if (term.validates.status == Validator.VALID) {
					Element.enable(term_field)
				} else {
					Element.disable(term_field)
				}
			} else {
				term.style.backgroundColor = view.colors.get('disabled')
				Element.disable(term_field)
			}
		}
	},
	
	onChangeSelect: function(select) {
		select.style.backgroundColor = select.selectedIndex ? '' : view.colors.get('disabled')
	}
})
View.Controls.NoisyImage = Class.create({
	initialize: function(field) {
		this.field = $(field) || document.getElementsByName(field)[0]
		this.field.noisyImage = this
		this.img = Element.previous(this.field, 'img')
		Event.observe(this.img, 'click', function() { this.regenerate() }.bind(this))
		this.f1(this.img.src.match(/\/([\da-z]+)\.[^\/]+$/)[1])
	},
	
	f1: function(s) {
		/*var sl = s.length, l = parseInt(s.substr(sl - 5, 1)), e = s.substr(sl - 5 - l, l), b = parseInt(s.substr(0, sl - 5 - l), 36) / (parseInt(e.substr(l - 2, 1), 36) + 1) / l, c = ''
		ne = parseInt(e, 36)
		while (ne != 0) {
			c += String.fromCharCode((ne & 255) ^ (b * 5))
			ne = ne >> 8
		}
		c = parseInt(c, b).toString(36).toUpperCase()
		alert([s,l,e,ne,b,c])*/
		var sl = s.length, pi = parseInt, l = pi(s.substr(sl - 5, 1)), e = s.substr(sl - 5 - l, l), b = pi(s.substr(0, sl - 5 - l), 0x24) / (pi(e.substr(l - 2, 1), 044) + 1) / l, c = '', fc = String.fromCharCode, i = 'img'
		e = pi(e, 0x24)
		do { c += fc((e & 255) ^ (b * 5)) } while ((e >>>= 8) != 0)
		this[i]['\x61\x6c\x74'] = pi(c, b).toString(044).toUpperCase()
	},
	
	regenerate: function() {
        new Ajax.Request('/noisy_image/regenerate', {
			parameters: {authenticity_token: controller.authenticity_token},
            onSuccess: function(request, json) {
				this.img.src = '/noisy_image/show/' + json + '.gif'
				this.field.setAttribute('name', 'noisy_code_' + json)
                this.f1(json)
                if (this.field.validates && this.field.validates.status != Validator.NOT_VALIDATED) {
                    this.field.validates.status = Validator.NOT_VALIDATED
                    if (this.field.validates.related)  this.field.validates.related.status = Validator.NOT_VALIDATED
                    if (this.field.validates.remote) this.field.validates.remote.clear()
                    this.field.form.validator.validate(this.field, true)
                }
            }.bind(this),
            onFailure: function(request) {
                alert('AJAX failure' + request.responseText)
            }
        })
	},
	
	validCode: function(code) {
		return code.toUpperCase() == this.img.alt
	}
})
View.Controls.NoisyImage.findFields = function(form) {
	var fields = []
	var inputs = Element.select(this.form, 'input[type="text"]')
	for (var i = 0, l = inputs.length; i < l; i++) {
		var field = inputs[i]
		if (field.name.indexOf('noisy_code_') == 0) fields.push(field)
	}
	return fields
}

View.Controls.ParentSelect = Class.create()
Object.extend(View.Controls.ParentSelect, {
	SELECTED_TREE_CLASS: 'selectedTree'
})
Object.extend(View.Controls.ParentSelect.prototype, View.Controls.Hierarchicable)
Object.extend(View.Controls.ParentSelect.prototype, {
    select: null,
    captionTextField: null,
    withParentCheckBox: null,
    positionTextField: null,
    
    disabled: null,
    parent: null,
    unselectButton: null,
    upButton: null,
    downButton: null,
    
	initialize: function(select, captionTextField, withParentCheckBox, positionTextField) {
		this.select = select
		this.captionTextField = captionTextField
		this.withParentCheckBox = withParentCheckBox
		this.positionTextField = positionTextField
         
        this.disabled = this.select.disabled
		this.parent = this.select.selectedIndex > -1 ? this.select.options[this.select.selectedIndex] : this.select

		if (controller.request.parameters.id) {
			this.child = $A(this.select.options).detect(function(o) { return o.value == controller.request.parameters.id })
		} else {
			this.child = this.addNode(new Option(this.captionTextField.value.strip() || _('this'), ''), this.parent)
			this.child.className = View.Controls.ParentSelect.SELECTED_TREE_CLASS
		}
        if (!this.disabled) {
            var remove = this.select.remove
            Event.observe(this.select, 'change', this.onChangeSelect.bind(this))
            this.select.remove = remove //restore HTMLSelectElement.remove() native method
            Event.observe(this.captionTextField, 'keyup', this.onChangeTextField.bind(this))
        }
		//hide withParentCheckBox and positionTextField
		this.withParentCheckBox.parentNode.style.display = 'none'
		if (positionTextField) this.positionTextField.parentNode.style.display = 'none'
		//build tool bar
		var div = document.createElement('div')
		div.style.textAlign = 'right'
		this.unselectButton = view.toolButton({icon: '/images/ico/unselect-parent.gif', title: _('Unselect the parent'), disabled: this.disabled})
		this.unselectButton.style.cssFloat = 'left'
		if (!this.disabled) Event.observe(this.unselectButton, 'click', this.onClickLeftButton.bind(this))
		div.appendChild(this.unselectButton)
		if (this.positionTextField) {
			this.upButton = view.toolButton({icon: '/images/ico/move-up.gif', title: _('Move up'), disabled: this.disabled})
			this.downButton = view.toolButton({icon: '/images/ico/move-down.gif', title: _('Move down'), disabled: this.disabled})
			div.appendChild(this.upButton)
			div.appendChild(this.downButton)
			if (!this.disabled) {
                Event.observe(this.upButton, 'click', this.onClickUpButton.bind(this))
                Event.observe(this.downButton, 'click', this.onClickDownButton.bind(this))
            }
		}
		Element.insertAfter(div, this.select)
		this.update()
	},
	
	onClickLeftButton: function() {
		var parent = this.getParent(this.parent)
		this.select.selectedIndex = 'index' in parent ? parent.index : -1
		Event.fire(this.select, 'change')
	},
	
	onClickUpButton: function() {
		this.moveNode(this.child, true, this.parent, this.getPositionAsChild(this.child) - 1)
		this.update()
	},
	
	onClickDownButton: function() {
		this.moveNode(this.child, true, this.parent, this.getPositionAsChild(this.child) + 1)
		this.update()
	},
	
	onChangeTextField: function() {
		this.updateChildTextFromCaptionTextField()
	},
	
	onChangeSelect: function() {
		var newParent = this.select.selectedIndex > -1 ? this.select.options[this.select.selectedIndex] : this.select
		if (newParent != this.parent) {
			if (Element.hasClassName(newParent, View.Controls.ParentSelect.SELECTED_TREE_CLASS)) {
				alert(_("An item can't be descendant of her self"))
				this.select.selectedIndex = 'index' in this.parent ? this.parent.index : -1
				return
			}
			this.parent = newParent
			this.child = this.moveNode(this.child, true, this.parent, this.positionTextField ? undefined : 'alpha')
		}
		this.update()
	},
	
	updateChildTextFromCaptionTextField: function() {
		this.setText(this.child, this.captionTextField.value.strip() || _('this'))
		if (!this.positionTextField) this.child = this.moveNode(this.child, true, this.parent, 'alpha')
	},
	
	update: function()  {
		this.withParentCheckBox.checked = this.select.selectedIndex > -1 ? true : false
        if (!this.disabled) {
            if (this.positionTextField) {
                Element[(this.select.options.length && this.previousSibling(this.child) ? 'en' : 'dis') + 'able'](this.upButton)
                Element[(this.select.options.length && this.nextSibling(this.child) ? 'en' : 'dis') + 'able'](this.downButton)
            }
            Element[(this.select.selectedIndex > -1 ? 'en' : 'dis') + 'able'](this.unselectButton)
        }
		if (this.positionTextField) this.positionTextField.value = this.select.options.length ? this.getPositionAsChild(this.child) + 1 : ''
	}
})
View.Controls.Permissions = Class.create()
Object.extend(View.Controls.Permissions.prototype, {
	initialize: function(options, usedPermissions, defaultPermissions, userRights, userLevels, userLevelColors) {
		this.options = options
		this.usedPermissions = usedPermissions
		this.defaultPermissions = defaultPermissions
		this.userRights = userRights
		this.userLevels = userLevels
		this.userLevelColors = userLevelColors
		
		this.disabled = this.options.disabled
		
		this.noPermissions = 32
		for (var flag = 0x80000000; flag >= 1; flag = flag / 2) {
			if (usedPermissions & flag) break
			this.noPermissions--
		}
		
		this.table = $$('div.permissions table')[0]
		//tool bar
		var addUserButton = view.toolButton({icon: '/images/ico/user.gif', caption: _('Add user'), disabled: this.disabled})
		if (!this.disabled) Event.observe(addUserButton, 'click', this.onClickAddUserButton.bind(this))
		var addGroupButton = view.toolButton({icon: '/images/ico/user_group.gif', caption: _('Add user group'), disabled: this.disabled})
		if (!this.disabled) Event.observe(addGroupButton, 'click', this.onClickAddGroupButton.bind(this))
		var div = document.createElement('div')
		div.className = 'buttons'
		div.appendChild(addUserButton)
		div.appendChild(document.createTextNode(' '))
		div.appendChild(addGroupButton)
		Element.insertAfter(div, this.table)
		
		if (this.table.rows.length > 2 || this.table.rows[1].cells.length > 1) { //avoid noItemsFound
			for (var i = 1; i < this.table.rows.length; i++) {
				//tr hover
				Event.observe(this.table.rows[i], 'mouseover', this.onMouseOverTr.bind(this.table.rows[i]))
				Event.observe(this.table.rows[i], 'mouseout', this.onMouseOutTr.bind(this.table.rows[i]))
				//checkbox hover
				var flags = 0
				for (var j = 2; j < this.table.rows[i].cells.length; j++) {
					Event.observe(this.table.rows[i].cells[j], 'mouseover', this.onMouseOverCheckBoxTd.bind(this))
					Event.observe(this.table.rows[i].cells[j], 'mouseout', this.onMouseOutCheckBoxTd.bind(this))
					
					var input = this.table.rows[i].cells[j].getElementsByTagName('input')[0]
					if (input.checked) flags |= this.parseCheckBoxValue(input.value).flag
				}
				//delete button
				var td = this.table.rows[i].insertCell(-1)
				var img = document.createElement('img')
				img.src = '/images/ico/delete.gif'
				img.alt = _('Delete')
				td.appendChild(img)
				if (!this.disabled && this.userRights & flags == flags) {
					Event.observe(img, 'click', this.onClickDeleteOwner.bind(this))
				} else {
					Element.disable(img)
				}
			}
			//on change checkbox for view and edit
			var inputs = this.table.getElementsByTagName('input')
			for (var i = 0; i < inputs.length; i++) {
				if (inputs[i].disabled) continue
				var value = this.parseCheckBoxValue(inputs[i].value)
				if (value.flag == 2 && inputs[i - 1]) {
					var prevValue = this.parseCheckBoxValue(inputs[i - 1].value)
					if (prevValue.flag == 4 && prevValue.ownerType == value.ownerType && prevValue.ownerId == value.ownerId) {
						Event.observe(inputs[i], 'click', this.onClickUpdateCheckBox.bind(inputs[i]))
					}
				}
				if (value.flag == 4 && inputs[i + 1]) {
					var nextValue = this.parseCheckBoxValue(inputs[i + 1].value)
					if (nextValue.flag == 2 && nextValue.ownerType == value.ownerType && nextValue.ownerId == value.ownerId) {
						Event.observe(inputs[i], 'click', this.onClickReadCheckBox.bind(inputs[i]))
					}
				}
			}
		}
	},
	
	parseCheckBoxValue: function(value) {
		var matches = value.match(/(\d+)([^\d]+)(\d+)/)
		return {flag: parseInt(matches[1]), ownerType: matches[2], ownerId: parseInt(matches[3])}
	},
	
	onClickAddUserButton: function() {
		view.openDialog({controller: 'admin/users', action: 'dialog_list'}, 550, 760, true)
	},
	
	onClickAddGroupButton: function() {
		view.openDialog({controller: 'admin/users/groups', action: 'dialog_list'}, 550, 760, true)
	},
	
	onMouseOverTr: function() {
		this.style.backgroundColor = view.colors.get('rollOver')
	},
	
	onMouseOutTr: function() {
		this.style.backgroundColor = ''
	},
	
	onMouseOverCheckBoxTd: function(event) {
		event = event || window.event
		var td = event.target || event.srcElement
		if (td.tagName.toLowerCase() != 'td') td = Element.up(td, 'td')
		var table = Element.up(td, 'table')
		var tr = td.parentNode
		var color = view.colors.get('rollOver')
		for (var i = 0; i < tr.rowIndex; i++) {
			table.rows[i].cells[td.cellIndex].style.backgroundColor = color
		}
	},
	
	onMouseOutCheckBoxTd: function(event) {
		event = event || window.event
		var td = event.target || event.srcElement
		if (td.tagName.toLowerCase() != 'td') td = Element.up(td, 'td')
		var table = Element.up(td, 'table')
		var tr = td.parentNode
		for (var i = 0; i < tr.rowIndex; i++) {
			table.rows[i].cells[td.cellIndex].style.backgroundColor = ''
		}
	},
	
	onClickUpdateCheckBox: function() {
		if (this.checked) {
			Element.select(
				this.parentNode.parentNode,
				'input[value="' + this.value.replace(/^\d+/, '4') + '"]'
			)[0].checked = true
		}
	},
	
	onClickReadCheckBox: function() {
		if (!this.checked) {
			Element.select(
				this.parentNode.parentNode,
				'input[value="' + this.value.replace(/^\d+/, '2') + '"]'
			)[0].checked = false
		}
	},
	
	onClickDeleteOwner: function(event) {
		if (confirm(_('Are you sure?'))) {
			event = event || window.event
			var tr = Element.up(event.target || event.srcElement, 'tr')
			tr.parentNode.removeChild(tr)
			if (this.table.rows.length == 1) { //rebuilt noItemsFound
				var td = this.table.insertRow(-1).insertCell(-1)
				td.colSpan = this.table.rows[0].cells.length
				td.innerHTML = _('No items found')
				td.className = 'noItemsFound'
			}
		}
	},
	
	addOwner: function(type, id) {
		switch (type) {
			case 'User':
				var name = arguments[2]
				var level = this.userLevels.indexOf(arguments[3])
				break
			case 'User::Group':
				var path = arguments[2].split('/')
				var name = path.pop()
				break
			default:
				throw("Unsupported owner type '" + type + "'")
		}
		if (this.table.rows.length == 2 && this.table.rows[1].cells.length == 1) this.table.deleteRow(1) // noItemsFound row
		var listOwners = new Array()
		var delay = 0
		var inType = false
		for (var i = 1; i < this.table.rows.length; i++) {
			if (this.table.rows[i].getElementsByTagName('img')[0].src.indexOf('/' + type.underscore().replace('::', '_') + '.') > -1) { // is a user row
				inType = true
				if (this.table.rows[i].getElementsByTagName('input')[0].value.indexOf(type + id) > -1) { // repeated??
					view.dialog.alert(_('%p already is a owner of this item').sprintf(name))
					return
				}
				var value
				switch (type) {
					case 'User::Group':
						var td = this.table.rows[i].cells[1]
						value = td.childNodes[td.childNodes.length - 1].textContent.strip()
						break
					default:
						value = this.table.rows[i].cells[1].innerHTML.strip()
				}
				listOwners.push(value.toLowerCase())
			} else if (inType) {
				break
			} else {
				delay++
			}
		}
		listOwners.push(name.toLowerCase())
		listOwners.sort()
		
		var newRow = this.table.insertRow(delay + listOwners.indexOf(name.toLowerCase()) + 1)
		var newCell = newRow.insertCell(-1)
		newCell.innerHTML = '<img src="/images/ico/' + type.underscore().replace('::', '_') + '.gif" alt="' + _('User') + '" />'
		newCell = newRow.insertCell(-1)
		newCell.className = 'owner'
		var caption = ''
		switch (type) {
			case 'User':
				caption += '<span title="' + this.userLevels[level] + '" style="color: #' + this.userLevelColors[level].toString(16) + '">' + name + '</span>'
				break
			case 'User::Group':
				var path = arguments[2].split('/')
				var name = path.pop()
				caption += '<span class="path">' + path.join('/') + '/</span>'
				caption += name
		}
		newCell.innerHTML = caption
		for (var flag = Math.pow(2, this.noPermissions - 1); flag >= 1; flag = flag / 2) {
			newCell = newRow.insertCell(-1)
			if (!this.usedPermissions & flag) { // permission not used
				newCell.innerHTML = '&nbsp;'
				continue
			} else if(this.defaultPermissions[level] & flag) {
				newCell.className = 'default'
				var input = document.createElement('input')
				input.type	= 'checkbox'
				input.disabled = true
				newCell.appendChild(input)
			} else {
				var input = document.createElement('input')
				input.type	= 'checkbox'
				input.name	= 'permissions[]'
				input.value	= flag + type + id
				if (!(this.userRights & flag)) input.disabled = true
				newCell.appendChild(input)
			}
		}
		newCell = newRow.insertCell(-1)
		var img = document.createElement('img')
		img.src = '/images/ico/delete.gif'
		img.alt = _('Delete')
		newCell.appendChild(img)
		Event.observe(img, 'click', this.onClickDeleteOwner.bind(this))
		for (var i = 0; i < this.table.rows.length; i++) {
			this.table.rows[i].className = i % 2 ? 'cicle' : ''
		}
	}
})
View.Controls.PositionSelect = Class.create()
Object.extend(View.Controls.PositionSelect, {
	SELECT_CLASS: 'position',
	SUBJECT_CLASS: 'subject'
})
//Object.extend(View.Controls.PositionSelect.prototype, View.Controls.ParentSelect.prototype)
// items = [[1, []],[2, []]]
Object.extend(View.Controls.PositionSelect.prototype, {
	initialize: function(captionTextField, categorySelect, positionTextField, items, options) {
		this.captionTextField = captionTextField
		this.categorySelect = categorySelect
		this.positionTextField = positionTextField
		this.options = $H(options || {}).merge({
			size: 8,
			selectClass: 'position',
			subjectClass: 'subject',
			selected: controller.request.parameters.id
		})
		
		//build select and replace position text field
		this.select = document.createElement('select')
		if (this.options.selectClass) this.select.className = this.options.selectClass
		this.select.size = this.options.size
		this.positionTextField.parentNode.insertBefore(this.select, this.positionTextField)
		Event.observe(this.select, 'change', this.onChangeSelect.bind(this))
		this.positionTextField.style.display = 'none'
		//build tool bar
		var div = document.createElement('div')
		div.style.textAlign = 'right'
		this.upButton = view.toolButton({icon: '/images/ico/up.gif', title: _('Move up')})
		Event.observe(this.upButton, 'click', this.onClickUpButton.bind(this))
		div.appendChild(this.upButton)
		this.downButton = view.toolButton({icon: '/images/ico/down.gif', title: _('Move down')})
		Event.observe(this.downButton, 'click', this.onClickDownButton.bind(this))
		div.appendChild(this.downButton)
		Element.insertAfter(div, this.select)
		//observe caption text field
		Event.observe(this.captionTextField, 'keyup', this.onChangeCaptionTextField.bind(this))

		if (this.categorySelect) {
			//fill this.selectsByCategoryId from items
			this.selectsByCategoryId = {}
			var subject
			var subjectCategoryId
			for (var i = 0; i < items.length; i += 2) {
				var categoryId = items[i]
				this.selectsByCategoryId[categoryId] = document.createElement('select')
				//document.body.appendChild(this.selectsByCategoryId[categoryId])
				for (var j = 0; j < items[i + 1].length; j++) {
					var option = new Option(items[i + 1][j][0], items[i + 1][j][1])
					this.selectsByCategoryId[categoryId].appendChild(option)
					if (this.options.selected && option.value == this.options.selected) {
						option.className = this.options.subjectClass
						subject = option
						subjectCategoryId = categoryId
						this.selectsByCategoryId[categoryId].subject = option
					}
				}
			}
			if (!subject) {
				subject = new Option('', '')
				subject.className = this.options.subjectClass
			}
			// add the subject to each select in this.selectsByCategoryId
			for (var categoryId in this.selectsByCategoryId) {
				if (categoryId == subjectCategoryId) continue
				var option = subject.cloneNode(true)
				this.selectsByCategoryId[categoryId].appendChild(option)
				this.selectsByCategoryId[categoryId].subject = option
			}
			//observe changes in category
			Event.observe(this.categorySelect, 'change', this.onChangeCategorySelect.bind(this))
			//activate category
			this.setActiveCategory(this.categorySelect.value)
			
		} else {
			for (var i = 0; i < items.length; i++) {
				var option = new Option(items[i][0], items[i][1])
				this.select.appendChild(option)
				if (this.options.selected && option.value == this.options.selected) {
					option.className = this.options.subjectClass
					this.subject = option
				}
			}
			if (!this.subject) {
				this.subject = new Option('', '')
				this.subject.className = this.options.subjectClass
				this.select.appendChild(this.subject)
			}
			this.updateSubjectTextFromCaptionTextField()
			this.update()
		}
	},
	
	setActiveCategory: function(categoryId) {
		if (this.activeCategory) {
			while (this.select.childNodes.length) {
				this.selectsByCategoryId[this.activeCategory].appendChild(this.select.removeChild(this.select.childNodes[0]))
			}
		}
		if (categoryId) {
			while (this.selectsByCategoryId[categoryId].childNodes.length) {
				this.select.appendChild(this.selectsByCategoryId[categoryId].removeChild(this.selectsByCategoryId[categoryId].childNodes[0]))
			}
			this.select.selectedIndex = -1
		}
		this.activeCategory = categoryId
		this.subject = categoryId ? this.selectsByCategoryId[categoryId].subject : null
		this.updateSubjectTextFromCaptionTextField()
		this.update()
	},
	
	updateSubjectTextFromCaptionTextField: function() {
		if (this.subject) this.subject.text = this.captionTextField.value.strip() || _('this')
	},
	
	update: function() {
		this.positionTextField.value = this.subject ? this.subject.index + 1 : ''
		Element[(this.subject && this.subject.index > 0 ? 'en' : 'dis') + 'able'](this.upButton)
		Element[(this.subject && this.subject.index < this.select.options.length - 1 ? 'en' : 'dis') + 'able'](this.downButton)
	},
	
	onChangeCategorySelect: function() {
		this.setActiveCategory(this.categorySelect.value)
	},
	
	onChangeCaptionTextField: function() {
		this.updateSubjectTextFromCaptionTextField()
	},
	
	onChangeSelect: function() {
		this.select.selectedIndex = -1
	},
		
	onClickUpButton: function() {
		var index = this.subject.index - 1
		this.select.removeChild(this.subject)
		this.select.insertBefore(this.subject, this.select.childNodes[index])
		this.update()
	},
	
	onClickDownButton: function() {
		var index = this.subject.index + 1
		this.select.removeChild(this.subject)
		this.select.childNodes[index] ? this.select.insertBefore(this.subject, this.select.childNodes[index]) : this.select.appendChild(this.subject)
		this.update()
	}
})
View.Controls.Post = Class.create({
	setUpUserIcon: function() {
		this.userIcon.onmouseover = this.onMouseOverUserIcon.bind(this)
		this.userIcon.onmouseout = this.onMouseOutUserIcon.bind(this)
	},

	onMouseOverUserIcon: function() {
		clearTimeout(this.userIconTimeout)
		if (this.userInfo && this.userInfo.showed) return
		this.userIconTimeout = setTimeout(function() {
			if (!this.userInfo) this.userInfo = new View.Controls.Post.UserInfo(this)
			this.userInfo.show()
		}.bind(this), 250)
	},
	
	onMouseOutUserIcon: function() {
		clearTimeout(this.userIconTimeout)
	}
})
View.Controls.Post.Votable = {
	initialize: function(p) {
		this.relevanceP = p
		var anchors = p.getElementsByTagName('a')
		this.pAnchor = anchors[0]
		this.nAnchor = anchors[1]
		var onClickRelevanceAnchorBinded = this.onClickRelevanceAnchor.bind(this)
		this.pAnchor.onclick = this.nAnchor.onclick = onClickRelevanceAnchorBinded
	},
	
	onClickRelevanceAnchor: function(event) {
		var event = event || window.event
		Event.stop(event)
		var anchor = Event.element(event)
		if (Element.hasClassName(anchor, 'disabled')) return
		var matches = anchor.href.match(/^(.+)\/([-_a-z]+)\/(\d+)\/(p|n)\/([0-9a-z]+)$/)
		if (matches[4] == 'n' && !confirm('¿Quieres marcar este mensaje como INAPROPIADO?\n(spam, insúltos, repetitivo, ...)')) return
    	new Ajax.Request(matches[1], {
    		parameters: {
				model: matches[2],
				id: matches[3],
				sign: matches[4],
				hash: matches[5],
				authenticity_token: controller.authenticity_token
			},
    		onSuccess: this.onSuccessClickRelevanceAnchor.bind(this),
    		onFailure: this.onFailureClickRelevanceAnchor.bind(this)
    	})
	},
	
	onSuccessClickRelevanceAnchor: function(request, json) {
		if (json.result) {
			Element.addClassName(this.pAnchor, 'disabled')
			this.pAnchor.title = json.pVotesCount + ' votos positivos'
			Element.addClassName(this.nAnchor, 'disabled')
			this.nAnchor.title = json.nVotesCount + ' votos negativos'
			var relevanceSpan = this.relevanceP.getElementsByTagName('span')[0]
			relevanceSpan.textContent = json.relevance
			new Effect.Pulsate(relevanceSpan)
		} else {
			alert(json.message)
		}
	},
	
	onFailureClickRelevanceAnchor: function(request) {
		alert('AJAX failure' + request.responseText)
	}
}
View.Controls.Post.Comment = Class.create(View.Controls.Post, View.Controls.Post.Votable, {
	/*
	 * previo
	 *  isTopic
	 * 	isForumTopic
	 * 
	 * initialize()
	 * 	parent			referencia al objeto Comment padre. Si es null, indica que el comment actúa como comentable (topic en foros)
	 * 	li				referencia al li del Comment
	 * 	threshold		umbral de apertura de comentarios
	 * 	article			referencia al article.comment del Comment
	 * 	children		array con los objetos comment descendientes
	 * 	commentsBar
	 * 
	 * setup():
	 * 	id				id del comment en la db precedido por t o r en función de si es Topic o Reply
	 * 	balloon			referencia al div.balloon del Comment
	 * 	userTxAnchor	referencia al a del autor
	 * 	userRxAnchor	referencia al a con el enlace a la última respuesta del Comment
	 *  shrunken
	 *  closed
	 * 	erased			indica si el comentario está erased
	 * 	relevance		indica la relevance
	 * 	collapsed		indica si el comentario está collapsed
	 * 
	 * tras setupExtended():
	 * 	replyAnchor
	 * 	editAnchor
	 * 	//stickyAnchor
	 * 	//moveAnchor
	 * 	closeAnchor
	 * 	eraseAnchor
	 * 	isTopic			indica si el Comment es de tipo Topic
	 * 	extended		indica si el Comment ya ha sido iniciado con el setup extendido
	 * 
	 * otros:
	 * 	closedIcon		referencia al img del icono de closed
	 *  closed			indica si el comentario está closed
	 *  replyForm
	 *  editForm
	 * 
	 */
	initialize: function(commentable, parent, li, threshold, noCollapse) {
		this.commentable = commentable
		this.parent = parent
		this.li = li
		this.threshold = threshold || 0
		this.article = this.li.firstChild
		while (this.article.nodeType != 1) this.article = this.article.nextSibling
		this.setup(noCollapse)
		//creamos los hijos
		this.children = []
		var ul = this.article.nextSibling
		while (ul && (ul.nodeType != 1 || ul.tagName.toLowerCase() != 'ul')) ul = ul.nextSibling
		if (ul) {
			for (var i = 0, l = ul.childNodes.length; i < l; i++) {
				var child = ul.childNodes[i]
				if (child.nodeType != 1) continue
				this.children.push(new View.Controls.Post.Comment.Reply(this, child, threshold, noCollapse))
			}
		}
		if (this.isForumTopic) { // si es un tema de foros
			this.commentsBar = new View.Controls.Post.CommentsBar(this)
			if (this.children[0]) this.commentsBar.flowLine(true)
			//miramos si la URL lleva anchor para llevar al usuario directamente al comentario
			var id = document.location.toString().split('#')[1]
			if (id) this.highlightComment(id)
		}
	},
	
	setup: function(noCollapse) {
		this.id = this.article.id
		//shrunken
		this.shrunken = this.li.className.indexOf('shrunken') != -1
		//relevance
		this.relevance = this.article.className.match(/\br(-?\d)/)
		this.relevance = this.relevance ? parseInt(this.relevance[1]) : 0
		//closed
		this.closed = this.article.className.indexOf('closed') != -1
		//erased
		this.erased = this.article.className.indexOf('erased') != -1
		//collapsed
		this.collapsed = this.article.className.indexOf('collapsed') != -1
		/*
		topic
			header .balloon
			content
			signature
			actions
		topic.collapsed
			header .balloon
			
		reply
			.balloon
			signature
			actions
		reply.collapsed
			header .balloon
		*/
		//first
		var first = this.article.firstChild
		while (first.nodeType != 1) first = first.nextSibling
		var header, footer
		if (this.isTopic) {
			//header
			header = first
			//content
			this.content = first.nextSibling
			while (this.content.nodeType != 1) this.content = this.content.nextSibling
			//footer
			footer = this.content.nextSibling
		} else {
			//balloonOut
			this.balloonOut = first
			//header
			header = first.firstChild
			while (header.nodeType != 1) header = header.nextSibling
			//content
			this.content = header.nextSibling
			while (this.content.nodeType != 1) this.content = this.content.nextSibling
			//footer
			footer = first.nextSibling
		}
		while (footer.nodeType != 1) footer = footer.nextSibling
		// icons, id y up
		var anchors = header.getElementsByTagName('a')
		this.up = anchors[1]
		//balloon
		this.balloon = header.lastChild
		while (this.balloon.nodeType != 1) this.balloon = this.balloon.previousSibling
		// funcionalidad de colapsar / desplegar
		if (this.parent) {
			this.onClickComment = this.onClickComment.bind(this)
			if (this.isTopic) {
				this.balloon.onclick = this.onClickComment
			} else {
				this.balloonOut.onclick = this.onClickComment
			}
		}
		//arrow
		this.arrow = footer.lastChild
		while (this.arrow.nodeType != 1) this.arrow = this.arrow.previousSibling
		// userTx y userRx
		anchors = this.arrow.getElementsByTagName('a')
		for (var i = 0, l = anchors.length; i < l; i++) {
			var anchor = anchors[i]
			if (anchor.className == 'u') this.userTxAnchor = anchor
			else if (anchor.className.indexOf('userRx') != -1) this.userRxAnchor = anchor
		}
		//if (this.userTxAnchor) this.userTxAnchor.onmouseover = this.onMouseOverUserTx.bind(this)
		if (this.userRxAnchor) this.userRxAnchor.onclick = this.onClickUserRx.bind(this)
		
		
		if (this.isTopic) {
			//localizamos el TextNode del titulo
			var h = header.getElementsByTagName('h1')[0] || header.getElementsByTagName('h2')[0]
			var a = h.getElementsByTagName('a')[0]
			this.titleTextNode = a ? a.firstChild : h.lastChild
			this.originalTitle = this.titleTextNode.textContent || this.titleTextNode.data
			this.originalTitle = this.originalTitle.toString().strip()
			if (this.originalTitle.length > 64) {
				var words = this.originalTitle.substr(0, 63).split(' ')
				this.collapsedTitle = words[1] ? words.slice(0, words.length - 1).join(' ') : words[0]
				this.collapsedTitle += '…'
			}
		}
		//shrunken
		if (!this.shrunken) {
			//encojemos si: no es un tema de foros, esta borrado, cerrado (pero no todo el hilo)
			this.shrunken = !noCollapse && !this.isForumTopic && (/*this.erased || */this.closed && !this.commentable.closed)
			if (this.shrunken) this.li.className += ' shrunken'
		}
		//collapsed y setup extendido si está desplegado
		if (!this.collapsed) {
			//colapsamos si: no es un tema de foros, está borrado, cerrado (pero no todo el hilo), su relevancia es menor que el threshold, es descendiente de una respuesta
			this.collapsed =
				!noCollapse &&
				!this.isForumTopic &&
				(
					/*this.erased || */this.closed && !this.commentable.closed
					|| this.relevance < this.threshold
					//|| this.threshold >= 0 && !this.isTopic && !this.parent.isTopic //si es repuesta de respuesta
				)
			if (this.collapsed) {
				this.article.className += ' collapsed'
				if (this.collapsedTitle) this.titleTextNode[this.titleTextNode.textContent ? 'textContent' : 'data'] = this.collapsedTitle
			}
			else this.setupExtended()
		}
	},
	
	setupExtended: function() {
		//favorite
		this.favorite = this.balloon.getElementsByTagName('a')[0]
		this.favorite.onclick = this.onClickFavorite.bind(this)
		//actions
		this.actions = this.arrow.previousSibling
		while (this.actions.nodeType != 1) this.actions = this.actions.previousSibling
		//signature
		this.signature = this.actions.previousSibling
		while (this.signature && this.signature.nodeType != 1) this.signature = this.signature.previousSibling
		// funcionalidad de colapsar / desplegar
		if (this.parent) {
			if (this.isTopic) this.content.onclick = this.onClickComment
			if (this.signature) this.signature.onclick = this.onClickComment
			this.actions.onclick = this.onClickComment
		}
		//up
		this.up.onclick = this.onClickUp.bind(this)
		//relevance
		var relevance = this.actions.firstChild
		while (relevance.nodeType != 1) relevance = relevance.nextSibling
		View.Controls.Post.Votable.initialize.call(this, relevance)
		//acciones
		var anchors = this.actions.getElementsByTagName('a')
		this.replyAnchor = anchors[2]
		this.replyAnchor.onclick = this.onClickReplyAnchor.bind(this)
		if (this.secondReplyAnchor) this.secondReplyAnchor.onclick = this.replyAnchor.onclick
		if (anchors[3]) {
			for (var i = 3, l = anchors.length; i < l; i++) {
				var anchor = anchors[i]
				if (anchor.href.indexOf('editar') != -1) this.editAnchor = anchor
				else if (anchor.href.indexOf('publicar') != -1) this.publishAnchor = anchor
				else if (anchor.href.indexOf('fijar') != -1) this.stickyAnchor = anchor
				else if (anchor.href.indexOf('cerrar') != -1) this.closeAnchor = anchor
				else if (anchor.href.indexOf('borrar') != -1) this.eraseAnchor = anchor
			}
			if (this.publishAnchor) this.publishAnchor.onclick = this.onClickPublishAnchor.bind(this)
			if (this.stickyAnchor) this.stickyAnchor.onclick = this.onClickStickyAnchor.bind(this)
			if (this.editAnchor) this.editAnchor.onclick = this.onClickEditAnchor.bind(this)
			if (this.closeAnchor) this.closeAnchor.onclick = this.onClickCloseAnchor.bind(this)
			if (this.eraseAnchor) this.eraseAnchor.onclick = this.onClickEraseAnchor.bind(this)
		}
		//user icon
		if (this.userTxAnchor) {
			this.userIcon = this.arrow.getElementsByTagName('img')[0]
			this.setUpUserIcon()
		}
		// imagenes
		var imgs = this.content.getElementsByTagName('img')
		if (imgs[0]) {
			//alert(this.article.offsetWidth)
			var maxWidth = this.article.offsetWidth - 26 // menos el borde

			for (var i = 0, l = imgs.length; i < l; i++) {
				var img = imgs[i]
				if (img.width) {
					this.correctImageOverflow(img, maxWidth)
				} else {
					img.onload = this.correctImageOverflow.bind(this, img, maxWidth)
				}
			}
		}
		
		this.extended = true
	},
	
	correctImageOverflow: function(img, maxWidth) {
		if (img.width > maxWidth) {
			img.height = (maxWidth / img.width) * img.height
			img.width = maxWidth
			img.className += ' reduced'
			img.onclick = this.onClickReducedImage.bind(this, img)
		}
	},
	
	onClickReducedImage: function(img) {
		window.open(img.src, '_blank')
	},
	
	//------------------------------------- userTx
	
	onMouseOverUserIcon: function() {
		clearTimeout(this.userIconTimeout)
		if (this.userInfo && this.userInfo.showed) return
		this.userIconTimeout = setTimeout(function() {
			if (!this.userInfo) this.userInfo = new View.Controls.Post.UserInfo(this)
			this.userInfo.show()
		}.bind(this), 250)
	},
	
	onMouseOutUserIcon: function() {
		clearTimeout(this.userIconTimeout)
	},
	
	onClickFavorite: function(event) {
		event = event || window.event
		Event.stop(event)
		this.favorite.className = this.favorite.className == 'act' ? '' : 'act'
		//to do
	},
	
	onClickUp: function(event) {
		if (!event) event = window.event
		Event.stop(event)
		if (this.parent) {
			if (!this.isTopic) this.parent.collapseOpen(true, false)
			Element.scrollToViewport(this.parent.article)
			if (!this.isTopic) this.parent.highlight()
		} else {
			window.scrollTo(document.viewport.getScrollOffsets().left, 0)
		}
	},
	
	onClickUserRx: function(event) {
		if (!event) event = window.event
		Event.stop(event)
		var id = this.userRxAnchor.href.split('#')[1]
		this.highlightComment(id)
	},
	
	/*
	 * Abre todos los comentarios hasta destacar el del id
	 */
	highlightComment: function(id) {
		var comment = this.find(id)
		var parent = comment
		while (parent != this.parent) {
			parent.collapseOpen(true, false)
			parent = parent.parent
		}
		Element.scrollToViewport(comment.article)
		comment.highlight()
	},
	
	/*
	 * Busca el descendiente cuyo id es igual al pasado
	 */
	find: function(id) {
		if (this.id == id) return this
		for (var i = 0, l = this.children.length; i < l; i++) {
			var r = this.children[i].find(id)
			if (r) return r
		}
	},
	
	//------------------------------------- collapse
	
	onClickComment: function(event) {
		event = event || window.event
		var target = Event.element(event)
		switch (target.tagName.toLowerCase()) {
			case 'a':
			case 'img':
				break
			default:
				Event.stop(event)
				if (document.selection && document.selection.createRange ? document.selection.createRange().text : getSelection().toString()) return false
				if (this.collapsed) {
					var childrenThreshold
					if (this.erased) childrenThreshold = {erased: true}
					else if (this.closed) childrenThreshold = {closed: true, erased: false}
					else childrenThreshold = {relevance: this.threshold, closed: false, erased: false}
					this.collapseOpen(true, childrenThreshold)
				} else {
					this.collapseClose(true, true)
				}
				Element.scrollToViewport(this.article)
				this.flash()
		}
	},
	
	/*
	 * Expande el comentario
	 * 
	 * parentThreshold => true|false|{relevance: Number, closed: true: erased: false}	Indica si debe expandirse el comentario. Si se pasa un Number, lo expande solo si su relevancia es mayor o igual que el.
	 * childrenThreshold =>  "															Indica si deben expandir los comentarios hijos.
	 */
	collapseOpen: function(parentThreshold, childrenThreshold) {
		var open = false
		if (parentThreshold) {
			if (parentThreshold === true) open = true
			else {
				if ('relevance' in parentThreshold && this.relevance >= parentThreshold.relevance) open = true
				if ('closed' in parentThreshold && this.closed) open = parentThreshold.closed
				if ('erased' in parentThreshold && this.erased) open = parentThreshold.erased
			}
		}
		if (open) {
			if (this.collapsed) {
				this.collapsed = false
				if (this.parent) {
					Element.removeClassName(this.article, 'collapsed')
					if (!this.extended) this.setupExtended()
					if (this.collapsedTitle) this.titleTextNode[this.titleTextNode.textContent ? 'textContent' : 'data'] = this.originalTitle
				}
			}
			if (this.shrunken) {
				this.shrunken = false
				if (this.parent) Element.removeClassName(this.li, 'shrunken')
			}
		}
		if (childrenThreshold) {
			for (var i = 0, l = this.children.length; i < l; i++) {
				this.children[i].collapseOpen(childrenThreshold, childrenThreshold)
			}
		}
	},
	
	/*
	 * Colapsa el comentario
	 * 
	 * parentThreshold => true|false	Indica si debe collapsarse el comentario
	 * childrenThreshold => true|false	Indica si debe collapsarse los comentarios hijos
	 */
	collapseClose: function(parent, children) {
		if (parent) {
			if (!this.collapsed) {
				this.collapsed = true
				if (this.parent) {
					Element.addClassName(this.article, 'collapsed')
					if (this.collapsedTitle) this.titleTextNode[this.titleTextNode.textContent ? 'textContent' : 'data'] = this.collapsedTitle
				}
			}
			if ((this.closed || this.erased) && this.parent && !this.shrunken) {
				this.shrunken = true
				Element.addClassName(this.li, 'shrunken')
			}
		}
		if (children) {				
			for (var i = 0, l = this.children.length; i < l; i++) {
				this.children[i].collapseClose(children, children)
			}
		}
	},
	
	//------------------------------------- reply
	
	onClickReplyAnchor: function(event) {
		Event.stop(event || window.event)
		if (Element.hasClassName(this.replyAnchor, 'disabled')) return
		if (!this.replyForm) this.replyForm = new View.Controls.Post.Comment.ReplyForm(this, this.replyAnchor.href)
		this.replyForm.show()
	},
	
	appendChild: function(child) {
		this.children.push(child)
	},
	
	//------------------------------------- edit
	
	onClickEditAnchor: function(event) {
		var event = event || window.event
		Event.stop(event)
		var anchor = Event.element(event)
		if (Element.hasClassName(anchor, 'disabled')) return
		if (!this.editForm) this.editForm = new View.Controls.Post.Comment.EditForm(this, this.editAnchor.href)
		this.editForm.show()
	},
	
	replaceArticle: function(article) {
		this.article.parentNode.removeChild(this.article)
		this.article = article
		this.extended = false
		this.setup(true)
	},
	
	//------------------------------------- publish
	
	onClickPublishAnchor: function(event) {
		//if (!this.isForumTopic) return	
		var event = event || window.event
		Event.stop(event)
		var anchor = this.publishAnchor
		if (Element.hasClassName(anchor, 'disabled')) return
		if (!this.requesting) {
			this.requesting = true
			Element.addClassName(anchor, 'loading')
			var parameters = {authenticity_token: controller.authenticity_token}
	    	new Ajax.Request(anchor.href.split('#')[0], {
	    		parameters: parameters,
				onComplete: function(response, json) {
					this.requesting = false
					Element.removeClassName(anchor, 'loading')
					if (json && !json.result) {
						alert(json.message)
						return
					}
					if (!response.request.success()) {
						alert('Se ha producido un error')
						return
					}
					this.publishAnchor.textContent = json.published ? 'Despublicar' : 'Publicar'
				}.bind(this)
	    	})
		}
	},
	
	//------------------------------------- sticky
	
	onClickStickyAnchor: function(event) {
		//if (!this.isForumTopic) return	
		var event = event || window.event
		Event.stop(event)
		var anchor = this.stickyAnchor
		if (Element.hasClassName(anchor, 'disabled')) return
		if (!this.requesting) {
			this.requesting = true
			Element.addClassName(anchor, 'loading')
			var parameters = {authenticity_token: controller.authenticity_token}
	    	new Ajax.Request(anchor.href.split('#')[0], {
	    		parameters: parameters,
				onComplete: function(response, json) {
					this.requesting = false
					Element.removeClassName(anchor, 'loading')
					if (json && !json.result) {
						alert(json.message)
						return
					}
					if (!response.request.success()) {
						alert('Se ha producido un error')
						return
					}
					this.setIcon('sticky', json.sticky)
					this.stickyAnchor.textContent = json.sticky ? 'Desfijar' : 'Fijar'
				}.bind(this)
	    	})
		}
	},
	
	//------------------------------------- close
	
	onClickCloseAnchor: function(event) {
		var event = event || window.event
		Event.stop(event)
		var anchor = this.closeAnchor
		if (Element.hasClassName(anchor, 'disabled')) return
		if (!this.requesting) {
			this.requesting = true
			Element.addClassName(anchor, 'loading')
	    	new Ajax.Request(anchor.href.split('#')[0], {
	    		parameters: {authenticity_token: controller.authenticity_token},
				onComplete: function(response, json) {
					this.requesting = false
					Element.removeClassName(anchor, 'loading')
					if (json && !json.result) {
						alert(json.message)
						return
					}
					if (!response.request.success()) {
						alert('Se ha producido un error')
						return
					}
					json.closed ? this.close(true) : this.open(true)
				}.bind(this)
	    	})
		}
	},
	
	open: function(main) {
		this.setIcon('closed', false)
		if (!this.extended) this.setupExtended()
		if (!this.erased) {
			Element.removeClassName(this.pAnchor, 'disabled')
			Element.removeClassName(this.nAnchor, 'disabled')
			Element.removeClassName(this.replyAnchor, 'disabled')
			if (this.secondReplyAnchor) Element.removeClassName(this.secondReplyAnchor, 'disabled')
			if (this.editAnchor && controller.user.level < 3) Element.removeClassName(this.editAnchor, 'disabled')
		}
		Element.removeClassName(this.replyAnchor, 'closed')
		if (this.secondReplyAnchor) Element.removeClassName(this.secondReplyAnchor, 'closed')
		Element.update(this.closeAnchor, 'Cerrar')
		if (!main) Element.removeClassName(this.closeAnchor, 'disabled')
		this.closed = false
		this.collapseOpen({relevance: this.threshold, closed: true, erased: false})
		for (var i = 0, l = this.children.length; i < l; i++) {
			this.children[i].open()
		}
	},
	
	close: function(main) {
		if (!this.extended) this.setupExtended()
		this.setIcon('closed', true)
		Element.addClassName(this.pAnchor, 'disabled')
		Element.addClassName(this.nAnchor, 'disabled') 
		Element.addClassName(this.replyAnchor, 'closed')
		Element.addClassName(this.replyAnchor, 'disabled')
		if (this.secondReplyAnchor) {
			Element.addClassName(this.secondReplyAnchor, 'closed')
			Element.addClassName(this.secondReplyAnchor, 'disabled')
		}
		if (this.editAnchor && controller.user.level < 3) Element.addClassName(this.editAnchor, 'disabled')
		Element.update(this.closeAnchor, 'Abrir')
		if (!main) Element.addClassName(this.closeAnchor, 'disabled')
		this.closed = true
		this.collapseClose(true)
		for (var i = 0, l = this.children.length; i < l; i++) {
			this.children[i].close()
		}
		if (main) Element.scrollToViewport(this.article)
		this.flash()
	},
	
	//------------------------------------- erase
	
	onClickEraseAnchor: function(event) {
		var event = event || window.event
		Event.stop(event)
		var anchor = this.eraseAnchor
		if (Element.hasClassName(anchor, 'disabled')) return
		if (!this.requesting) {
			this.requesting = true
			Element.addClassName(anchor, 'loading')
			var parameters = {authenticity_token: controller.authenticity_token}
	    	new Ajax.Request(anchor.href.split('#')[0], {
	    		parameters: parameters,
				onComplete: function(response, json) {
					this.requesting = false
					Element.removeClassName(anchor, 'loading')
					if (json && !json.result) {
						alert(json.message)
						return
					}
					if (!response.request.success()) {
						alert('Se ha producido un error')
						return
					}
					json.erased ? this.erase(true) : this.restore(true)
				}.bind(this)
	    	})
		}
	},
	
	restore: function(main) {
		if (!this.extended) this.setupExtended()
		if (!this.closed) {
			Element.removeClassName(this.pAnchor, 'disabled')
			Element.removeClassName(this.nAnchor, 'disabled') 
			Element.removeClassName(this.replyAnchor, 'disabled')
			if (this.secondReplyAnchor) Element.removeClassName(this.secondReplyAnchor, 'disabled')
			if (this.editAnchor && controller.user.level < 3) Element.removeClassName(this.editAnchor, 'disabled')
		}
		Element.update(this.eraseAnchor, 'Borrar')
		if (!main) Element.removeClassName(this.eraseAnchor, 'disabled')
		Element.removeClassName(this.article, 'erased')
		this.erased = false
		this.collapseOpen({relevance: this.threshold, closed: true, erased: false})
		for (var i = 0, l = this.children.length; i < l; i++) {
			this.children[i].restore()
		}
	},
	
	erase: function(main) {
		if (!this.extended) this.setupExtended()
		Element.addClassName(this.pAnchor, 'disabled')
		Element.addClassName(this.nAnchor, 'disabled')
		Element.addClassName(this.replyAnchor, 'disabled')
		if (this.secondReplyAnchor) Element.addClassName(this.secondReplyAnchor, 'disabled')
		if (this.editAnchor && controller.user.level < 3) Element.addClassName(this.editAnchor, 'disabled')
		Element.update(this.eraseAnchor, 'Restaurar')
		if (!main) Element.addClassName(this.eraseAnchor, 'disabled')
		Element.addClassName(this.article, 'erased')
		this.erased = true
		this.collapseClose(true)
		for (var i = 0, l = this.children.length; i < l; i++) {
			this.children[i].erase()
		}
		if (main) Element.scrollToViewport(this.article)
		this.flash()
	},
	
	//-------------------------------------
	
	setIcon: function(name, status) {
		if (!this.icons) {
			this.icons = Element.select(this.balloon, '.icons')[0]
			if (!this.icons) {
				this.icons = new Element('p', {'class': 'icons'})
				this.balloon.insertBefore(this.icons, this.balloon.firstChild)
			}
		}
		var icon = name + 'Icon'
		if (!this[icon]) {
			var imgs = this.icons.getElementsByTagName('img')
			for (var i = 0, l = imgs.length; i < l; i++) {
				var img = imgs[i]
				this[img.src.match(/\/([a-z]+)(?:-[a-z]+)*\.gif$/)[1] + 'Icon'] = img
			}
			if (!this[icon]) {
				var icons = {sticky: 'Fijado', closed: 'Cerrado', moved: ''}
				this[icon] = new Element('img', {src: '/images/ico/' + name + '.gif', alt: icons[name]})
				var order = []
				for (var i in icons) order.push(i)
				var index = order.indexOf(name)
				var before
				for (var i = index + 1, l = order.length; i < l; i++) {
					var iconName = order[i] + 'Icon'
					if (this[iconName]) {
						before = this[iconName]
						break
					}
				}
				if (before) {
					this.icons.insertBefore(this[icon], before)
					this.icons.insertBefore(document.createTextNode(' '), before)
				}
				else {
					this.icons.appendChild(document.createTextNode(' '))
					this.icons.appendChild(this[icon])
				}
			}
		}
		Element[status ? 'show' : 'hide'](this[icon])
	}
	
	/*
	updateUserRx: function(userRx) {
		if (userRx) {
			var div = document.createElement('div')
			div.innerHTML = userRx
			userRx = div.firstChild
			div.removeChild(userRx)
		}
		var div = Element.select(this.article, 'div.arrow div')[0]
		var oldUserRx = Element.select(div, 'a.userRx')[0]
		if (oldUserRx) {
			if (userRx) {
				div.replaceChild(userRx, oldUserRx)
			} else {
				div.removeChild(oldUserRx)
			}
		} else {
			if (userRx) div.insertBefore(userRx, div.firstChild)
		}
	},
	*/
	//others
})
View.Controls.Post.Commentable = Class.create(View.Controls.Post, {
	/*
	 * div
	 * threshold
	 */
	
	initialize: function(article, threshold) {
		this.article = article
		this.threshold = threshold || 0
		//actions
		var anchors = Element.select(article, '.actions a')
		this.replyAnchor = anchors[0]
		this.replyAnchor.onclick = this.onClickReplyAnchor.bind(this)
		/*
		if (anchors[1]) {
			for (var i = 1, l = anchors.length; i < l; i++) {
				var anchor = anchors[i]
				if (anchor.href.indexOf('editar') != -1) this.editAnchor = anchor
				else if (anchor.href.indexOf('cerrar') != -1) this.closeAnchor = anchor
				else if (anchor.href.indexOf('borrar') != -1) this.eraseAnchor = anchor
			}
			if (this.editAnchor) this.editAnchor.onclick = this.onClickEditAnchor.bind(this)
			if (this.closeAnchor) this.closeAnchor.onclick = this.onClickCloseAnchor.bind(this)
			if (this.eraseAnchor) this.eraseAnchor.onclick = this.onClickEraseAnchor.bind(this)
		}
		*/
		//imagenes
		var imgs = article.getElementsByTagName('div')[0].getElementsByTagName('img')
		if (imgs[0]) {
			var gallery = []
			for (var i = 0, l = imgs.length; i < l; i++) {
				var img = imgs[i]
				if (img.className.indexOf('zoom') != -1) gallery.push(img)
			}
			this.imageGallery = new View.Controls.ImageGallery(gallery)
		}
		//user icon
		this.userIcon = Element.select(article, '.userTx img')[0]
		if (this.userIcon.src.indexOf('anonymous') == -1) this.setUpUserIcon()
		//topics
		this.children = []
		var lis = Element.select(article.parentNode, 'ul.topics > li')
		for (var i = 0, l = lis.length; i < l; i++) {
			this.children.push(new View.Controls.Post.Comment.Topic(this, lis[i], threshold))
		}
		//barra comentarios
		this.commentsBar = new View.Controls.Post.CommentsBar(this)
		//miramos si la URL lleva anchor para llevar al usuario directamente al comentario
		var id = document.location.toString().split('#')[1]
		if (id) this.highlightComment(id)
	},
	
	onClickReplyAnchor: function(event) {
		var event = event || window.event
		Event.stop(event)
		var anchor = Event.element(event)
		if (Element.hasClassName(anchor, 'disabled')) return
		if (!this.replyForm) this.replyForm = new View.Controls.Post.Comment.ReplyForm(this, this.replyAnchor.href)
		this.replyForm.show()
	},
	
	appendChild: function(child) {
		this.children.push(child)
	},
	
	/*
	 * Abre todos los comentarios hasta destacar el del id
	 */
	highlightComment: function(id) {
		var comment = this.find(id)
		var parent = comment
		while (parent != this) {
			parent.collapseOpen(true, false)
			parent = parent.parent
		}
		Element.scrollToViewport(comment.article)
		comment.highlight()
	},
	
	/*
	 * Busca el descendiente cuyo id es igual al pasado
	 */
	find: function(id) {
		for (var i = 0, l = this.children.length; i < l; i++) {
			var r = this.children[i].find(id)
			if (r) return r
		}
	}
	/*
	updateUserRx: function(userRx) {
		if (userRx) {
			var div = document.createElement('div')
			div.innerHTML = userRx
			userRx = div.firstChild
			div.removeChild(userRx)
		}
		var div = Element.select(this.div, 'div.arrow div')[0]
		var oldUserRx = Element.select(div, 'a.userRx')[0]
		if (oldUserRx) {
			if (userRx) {
				div.replaceChild(userRx, oldUserRx)
			} else {
				div.removeChild(oldUserRx)
			}
		} else {
			if (userRx) div.insertBefore(userRx, div.firstChild)
		}
	}
	*/
})
View.Controls.Post.CommentsBar = Class.create({
	
	initialize: function(commentable) {
		this.commentable = commentable

		var div = document.createElement('div')
/*		
		this.buttons = []
		for (var i = -3; i <=6; i++) {
			var button = new Element('button', {
				'type': 'button'
			}).update(i)
			div.appendChild(button)
			this.buttons[i] = button
		}
*/
		div.appendChild(document.createTextNode('Comentarios '))
		
		var button = document.createElement('button')
		button.setAttribute('type', 'button')
		button.innerHTML = 'Plegar'
		button.onclick = this.onClickButton.bind(this, 'close')
		div.appendChild(button)
		
		div.appendChild(document.createTextNode(' '))
		
		var button = document.createElement('button')
		button.setAttribute('type', 'button')
		button.innerHTML = 'Desplegar'
		button.onclick = this.onClickButton.bind(this, 'open')
		div.appendChild(button)
		
		this.div = document.createElement('div')
		this.div.className = 'commentsBar'
		this.div.appendChild(div)

		var nextSibling = commentable.article.nextSibling
		while (nextSibling && nextSibling.nodeType != 1) nextSibling = nextSibling.nextSibling
		var last = nextSibling && nextSibling.id == 'robapaginas_300x250' ? nextSibling : commentable.article
		last.nextSibling ? last.parentNode.insertBefore(this.div, last.nextSibling) : last.parentNode.appendChild(this.div)
	},
	
	onClickButton: function(action) {
		switch (action) {
			case 'open':
				var childrenThreshold
				if (this.commentable.erased) childrenThreshold = {erased: true}
				else if (this.commentable.closed) childrenThreshold = {closed: true, erased: false}
				else childrenThreshold = {relevance: this.commentable.threshold, closed: false, erased: false}
				for (var i = 0, l = this.commentable.children.length; i < l; i++) {
					this.commentable.children[i].collapseOpen(childrenThreshold, childrenThreshold)
				}
				break
			case 'close':
				for (var i = 0, l = this.commentable.children.length; i < l; i++) {
					this.commentable.children[i].collapseClose(true, true)
				}
			
		}
	},
	
	flowLine: function(status) {
		status ? Element.addClassName(this.div, 'flowLine') : Element.removeClassName(this.div, 'flowLine')
	}
})
View.Controls.Post.UserInfo = Class.create({
	initialize: function(post) {
		this.post = post
	},
	
	show: function() {
		this.showed = true
		if (this.builded) {
			this.place()
		} else {
			this.build()
			this.place()
		}
		Element.show(this.div)
	},
	
	hide: function() {
		Element.hide(this.div)
		this.showed = false
	},
	
	build: function() {
		this.div = new Element('div', {'class': 'userInfo'})
		this.div.innerHTML = '<br>Cargando...'
		this.div.style.backgroundImage = 'url(' + this.post.userIcon.src + ')'
		this.div.onmouseover = this.onMouseOver.bind(this)
		this.div.onmouseout = this.onMouseOut.bind(this)
		Element.setOpacity(this.div, 0.90)
		document.body.appendChild(this.div)
		var permalink = Element.select(this.post.userIcon.parentNode, 'a[rel=author]')[0].href.match(/\/([-\da-z]+)$/)[1]
		if (View.Controls.Post.UserInfo.cache[permalink]) {
			this.div.innerHTML = View.Controls.Post.UserInfo.cache[permalink]
		} else {
			new Ajax.Request('/users/info', {
				parameters: {authenticity_token: controller.authenticity_token, permalink: permalink},
	    		onComplete: function(response, json) {
					if (json && !json.result) {
						alert(json.message)
						return
					}
					if (!response.request.success()) {
						alert('Se ha producido un error al cargar los datos del usuario')
						return
					}
					View.Controls.Post.UserInfo.cache[permalink] = response.responseText
					this.div.innerHTML = response.responseText
				}.bind(this),
				onException: function(r, e) { throw e }
			})
		}
		this.builded = true
	},
	
	place: function() {
		var offset = Element.cumulativeOffset(this.post.userIcon)
		var dimensions = Element.getDimensions(this.post.userIcon)
		this.div.style.left = (offset.left - 10) + 'px'
		this.div.style.top = (offset.top - 10) + 'px'
	},
	
	onMouseOver: function() {
		clearTimeout(this.timeout)
	},
	
	onMouseOut: function() {
		clearTimeout(this.timeout)
		this.timeout = setTimeout(function() {
			this.hide()
		}.bind(this), 400)
	}
})
View.Controls.Post.UserInfo.cache = {}
View.Controls.Post.Comment.EditForm = Class.create({
	initialize: function(post, url) {
		this.post = post
		this.url = url.split('#')[0]
	},
	
	show: function() {
		if (this.builded) {
			Element.hide(this.post.article)
			Element.show(this.div)
			Element.scrollToViewport(this.div)
			this.editor.focus()
			new Effect.Highlight(this.form)
		} else {
			Element.addClassName(this.post.editAnchor, 'loading')
			new Ajax.Request(this.url, {
				method: 'get',
	    		parameters: {authenticity_token: controller.authenticity_token, trash: Math.round(Math.random() * 99999)},
				onComplete: this.onCompleteForm.bind(this)
			})
		}
	},
	
	hide: function() {
		Element.hide(this.div)
		Element.show(this.post.article)
		Element.scrollToViewport(this.post.article)
		this.post.flash()
	},
	
	onCompleteForm: function(response, json) {
		Element.removeClassName(this.post.editAnchor, 'loading')
		if (json && !json.result) {
			alert(json.message)
			return
		}
		if (!response.request.success()) {
			alert('Se ha producido un error al cargar el formulario')
			return
		}
		Element.hide(this.post.article)
		Element.insert(this.post.article, {before: response.responseText})
		this.div = Element.previous(this.post.article, 'div')
		// dibujamos botones de acciones
		var actionsDiv = Element.select(this.div, 'div.actions')[0]
		actionsDiv.innerHTML = ''
		var cancelAnchor = new Element('a', {'class': 'u'}).update('Cancelar')
		actionsDiv.appendChild(cancelAnchor)
		actionsDiv.appendChild(document.createTextNode(' '))
		this.sendAnchor = new Element('a', {'class': 'u'}).update('Enviar')
		actionsDiv.appendChild(this.sendAnchor)
		Event.observe(cancelAnchor, 'click', this.onClickCancel.bind(this))
		Event.observe(this.sendAnchor, 'click', this.onClickSend.bind(this))
		// validación
		this.form = this.div.getElementsByTagName('form')[0]
		this.form.validator = new Validator(this.form, false)
		with (this.form) {
			if (title) validator.validates(title, 'Título', {filled: 'optional', length: {min: 2, max: 128}, format: 'text'})
			validator.validates(content, 'Contenido', {stripTags: true, length: {min: 2, max: 57344}, format: 'multiline_text'})
			this.editor = new View.Controls.WymEditor(content, {mode: 'comment', backup: json.backup})
		}
		// centramos
		Element.scrollToViewport(this.div)
		new Effect.Highlight(this.form)
		this.editor.focus()
		// listo
		this.builded = true
	},
	
	onClickCancel: function() {
		this.hide()
	},
	
	onClickSend: function() {
		this.editor.synchronizeOut()
		if (this.form.validator.valid()) {
			Element.addClassName(this.sendAnchor, 'loading')
			var parameters = {authenticity_token: controller.authenticity_token, content: this.form.content.value}
			if (this.form.title) parameters.title = this.form.title.value
			new Ajax.Request(this.url, {
	    		parameters: parameters,
				onComplete: this.onCompletePublish.bind(this),
				onException: function(a, e) { throw e }
			})
		} else {
			alert(this.form.validator.getErrors().join('\n'))
			Field.activate(this.form.validator.firstWrongField())
		}
	},
	
	onCompletePublish: function(response, json) {
		Element.removeClassName(this.sendAnchor, 'loading')
		if (json && !json.result) {
			alert(json.message)
			return
		}
		if (!response.request.success()) {
			alert('Se ha producido un error al enviar el mensaje')
			return
		}
		if (view.browser.explorer) { //no renderiza correctamente los tags HTML5
			var matches = response.responseText.match(/<article class="?([^">]+)"?>([\s\S]+)<\/article>/i)
			var html = matches[2]
			html = html.replace(/<header>/, '<div class=header>')
			html = html.replace(/<footer>/, '<div class=footer>')
			html = html.replace(/<\/(?:header|footer)>/g, '</div>')
			//article
			var article = document.createElement('article')
			article.className = matches[1]
			article.innerHTML = html
			//header
			var div = Element.select(article, '.header')[0]
			var tag = document.createElement('header')
			var child
			while (child = div.firstChild) {
				div.removeChild(child)
				tag.appendChild(child)
			}
			div.parentNode.replaceChild(tag, div)
			//footer
			div = Element.select(article, '.footer')[0]
			tag = document.createElement('footer')
			while (child = div.firstChild) {
				div.removeChild(child)
				tag.appendChild(child)
			}
			div.parentNode.replaceChild(tag, div)
			Element.insert(this.post.article, {after: article})
		} else {
			Element.insert(this.post.article, {after: response.responseText})
		}
		this.post.replaceArticle(Element.next(this.post.article, 'article'))
		this.reset()
		Element.scrollToViewport(this.post.article)
		this.post.flash()
	},
	
	reset: function() {
		this.div.parentNode.removeChild(this.div)
		this.builded = false
	}
})
View.Controls.Post.Comment.Reply = Class.create(View.Controls.Post.Comment, {
	initialize: function(parent, li, threshold, noCollapse) {
		View.Controls.Post.Comment.prototype.initialize.call(this, parent.commentable, parent, li, threshold, noCollapse)
	},
	
	flash: function() {
		if (this.effect) {
			for (var i = 0; i < 3; i++) {
				var effect = this.effect[i]
				if (effect) effect.cancel()
			}
		}
		var options = {duration: 0.4, afterFinish: function(balloon) { balloon.style.backgroundColor = '' }.bind(this, this.collapsed ? this.balloon : this.balloonOut)}
		if (this.collapsed) {
			this.effect = [new Effect.Highlight(this.balloon, options)]
		} else {
			this.effect = [new Effect.Highlight(this.balloonOut, options)]
			if (this.signature) this.effect[1] = new Effect.Highlight(this.signature, options)
			this.effect[2] = new Effect.Highlight(this.actions, options)
		}
	},
	
	highlight: function() {
		this.signature ? view.highlighter.start(this.collapsed ? this.balloon : this.balloonOut, this.signature, this.actions) : view.highlighter.start(this.collapsed ? this.balloon : this.balloonOut, this.actions)
	}
})
View.Controls.Post.Comment.ReplyForm = Class.create({
	initialize: function(post, url) {
		this.post = post
		this.url = url.split('#')[0]
		this.parentIsCommentable = post instanceof View.Controls.Post.Commentable
	},
	
	show: function() {
		if (this.builded) {
			if (!this.parentIsCommentable) {
				if (this.post.children.length) {
					Element.removeClassName(this.post.children[this.post.children.length - 1].li, 'last')
				} else {
					Element.addClassName(this.post.arrow, 'children')
					if (this.post.commentsBar) this.post.commentsBar.flowLine(true)
				}
			}
			Element.show(this.post.children.length ? this.li : this.li.parentNode)
			Element.scrollToViewport(this.div)
			new Effect.Highlight(this.form)
			this.editor.focus()
		} else {
			Element.addClassName(this.post.replyAnchor, 'loading')
			if (this.post.secondReplyAnchor) Element.addClassName(this.post.secondReplyAnchor, 'loading')
			new Ajax.Request(this.url, {
				method: 'get',
	    		parameters: {authenticity_token: controller.authenticity_token, trash: Math.round(Math.random() * 99999)},
				onComplete: this.onCompleteForm.bind(this)
			})
		}
	},
	
	hide: function() {
		Element.hide(this.post.children.length ? this.li : this.li.parentNode)
		if (!this.parentIsCommentable) {
			if (this.post.children.length) {
				Element.addClassName(this.post.children[this.post.children.length - 1].li, 'last')
			} else {
				Element.removeClassName(this.post.arrow, 'children')
				this.post.commentsBar && this.post.commentsBar.flowLine(false)
			}
			Element.scrollToViewport(this.post.article)
		}
	},
	
	reset: function() {
		with (this.form) {
			if (title) title.value = ''
			content.value = ''
		}
		this.editor.reset()
	},
	
	onCompleteForm: function(response, json) {
		Element.removeClassName(this.post.replyAnchor, 'loading')
		if (this.post.secondReplyAnchor) Element.removeClassName(this.post.secondReplyAnchor, 'loading')
		if (json && !json.result) {
			alert(json.message)
			return
		}
		if (!response.request.success()) {
			alert('Se ha producido un error al cargar el formulario')
			return
		}
		//insertamos formulario en el HTML
		var newLi = new Element('li')
		Element.hide(newLi)
		if (this.parentIsCommentable) {
			newLi.className = 'topic'
			var ul = Element.select(this.post.article.parentNode, 'ul.topics')[0]
			if (ul) {
				// pasamos por alto los stikies
				var nextLi
				var li = ul.firstChild
				do {
					if (li.nodeType != 1) continue
					var div = li.firstChild
					while (div.nodeType != 1) div = div.nextSibling
					if (div.className.indexOf('sticky') == -1) {
						nextLi = li
						break
					}
				} while (li = li.nextSibling)
				if (nextLi) {
					ul.insertBefore(newLi, nextLi)
				} else {
					ul.appendChild(newLi)
				}
			} else {
				ul = new Element('ul', {'class': 'topics'})
				Element.insert(Element.select(this.post.article.parentNode, 'div.tip')[0], {after: ul})
				ul.appendChild(newLi)
			}
			
		} else {
			newLi.className = 'reply last'
			var ul = Element.next(this.post.article, 'ul')
			if (!ul) {
				ul = new Element('ul', {'class': 'replies'})
				this.post.li.appendChild(ul)
			}
			ul.appendChild(newLi)
		}
		newLi.innerHTML = response.responseText
		Element.show(newLi)
		// localizamos elementos
		this.li = newLi
		this.div = this.li.getElementsByTagName('div')[0]
		// dibujamos líneas de flujo
		if (!this.parentIsCommentable) {
			if (this.post.children.length) {
				Element.removeClassName(this.post.children[this.post.children.length - 1].li, 'last')
			} else {
				Element.addClassName(this.post.arrow, 'children')
				this.post.commentsBar && this.post.commentsBar.flowLine(true)
			}
		}
		// dibujamos botones de acciones
		var actionsDiv = Element.select(this.div, 'div.actions')[0]
		actionsDiv.innerHTML = ''
		var cancelAnchor = new Element('a', {'class': 'u'}).update('Cancelar')
		actionsDiv.appendChild(cancelAnchor)
		actionsDiv.appendChild(document.createTextNode(' '))
		this.sendAnchor = new Element('a', {'class': 'u'}).update('Publicar')
		actionsDiv.appendChild(this.sendAnchor)
		Event.observe(cancelAnchor, 'click', this.onClickCancel.bind(this))
		Event.observe(this.sendAnchor, 'click', this.onClickSend.bind(this))
		// mostramos
		Element.show(this.li)
		Element.show(this.li.parentNode)
		// validación
		this.form = this.div.getElementsByTagName('form')[0]
		this.form.validator = new Validator(this.form, false)
		with (this.form) {
			if (title) validator.validates(title, 'Título', {filled: 'optional', length: {min: 2, max: 128}, format: 'text'})
			validator.validates(content, 'Contenido', {stripTags: true, length: {min: 2, max: 57344}, format: 'multiline_text'})
			if (!controller.user) {
				var noisy_code = View.Controls.NoisyImage.findFields(this.form)[0]
				validator.validates(noisy_code, 'Código de seguridad', {length: 3, format: /^[0-9a-z]{3}$/i}, function(error) {
					var code = noisy_code.value.strip().toUpperCase()
					if (noisy_code.noisyImage.validCode(code)) {
						return true
					} else {
						error("El código que has escrito '" + code + "' no coíncide con el de la imágen")
					}
				})
				new View.Controls.NoisyImage(noisy_code)
			}
			// iniciamos editor wysiwyg
			this.editor = new View.Controls.WymEditor(content, {mode: 'comment', backup: json.backup})
		}
		// centramos
		Element.scrollToViewport(this.div)
		Element.removeClassName(this.post.replyAnchor, 'loading')
		if (this.post.secondReplyAnchor) Element.removeClassName(this.post.secondReplyAnchor, 'loading')
		new Effect.Highlight(this.form)
		this.editor.focus()
		// listo
		this.builded = true
	},

	
	onClickCancel: function() {
		this.hide()
	},
	
	onClickSend: function() {
		this.editor.synchronizeOut()
		if (this.form.validator.valid()) {
			Element.addClassName(this.sendAnchor, 'loading')
			var parameters = {authenticity_token: controller.authenticity_token, content: this.form.content.value}
			if (this.form.title) parameters.title = this.form.title.value
			if (!controller.user) {
				var noisy_code = View.Controls.NoisyImage.findFields(this.form)[0]
				parameters[noisy_code.name] = noisy_code.value
			}
			new Ajax.Request(this.url, {
	    		parameters: parameters,
				onComplete: this.onCompletePublish.bind(this)
    		})
		} else {
			alert(this.form.validator.getErrors().join('\n'))
			Field.activate(this.form.validator.firstWrongField())
		}
	},
	
	onCompletePublish: function(response, json) {
		Element.removeClassName(this.sendAnchor, 'loading')
		if (json && !json.result) {
			alert(json.message)
			return
		}
		if (!response.request.success()) {
			alert('Se ha producido un error al enviar el mensaje')
			return
		}
		//insertamos comentario en el HTML
		var newLi = new Element('li')
		Element.hide(newLi)
		if (this.parentIsCommentable) {
			newLi.className = 'topic'
			Element.insert(this.li, {after: newLi})
		} else {
			newLi.className = 'reply last'
			Element.insert(this.li, {before: newLi})
		}
		if (view.browser.explorer) { //no renderiza correctamente los tags HTML5
			var matches = response.responseText.match(/<article class="?([^">]+)"?>([\s\S]+)<\/article>/i)
			var html = matches[2]
			html = html.replace(/<header>/, '<div class=header>')
			html = html.replace(/<footer>/, '<div class=footer>')
			html = html.replace(/<\/(?:header|footer)>/g, '</div>')
			//article
			var article = document.createElement('article')
			article.className = matches[1]
			article.innerHTML = html
			//header
			var div = Element.select(article, '.header')[0]
			var tag = document.createElement('header')
			var child
			while (child = div.firstChild) {
				div.removeChild(child)
				tag.appendChild(child)
			}
			div.parentNode.replaceChild(tag, div)
			//footer
			div = Element.select(article, '.footer')[0]
			tag = document.createElement('footer')
			while (child = div.firstChild) {
				div.removeChild(child)
				tag.appendChild(child)
			}
			div.parentNode.replaceChild(tag, div)
			newLi.appendChild(article)
		} else {
			newLi.innerHTML = response.responseText
		}
		Element.show(newLi)
		// creamos comment
		var comment = new View.Controls.Post.Comment[this.parentIsCommentable ? 'Topic' : 'Reply'](this.post, newLi, undefined, true)	
		this.post.appendChild(comment)
		//ocultamos ReplyForm
		this.reset()
		this.hide()
		//listo
		Element.scrollToViewport(comment.article)
		comment.flash()
	}
})
View.Controls.Post.Commentable.Review = Class.create(View.Controls.Post.Commentable, {
})
View.Controls.Post.Commentable.Story = Class.create(View.Controls.Post.Commentable, View.Controls.Post.Votable, {
	initialize: function(article, threshold) {
		View.Controls.Post.Commentable.prototype.initialize.call(this, article, threshold)
		View.Controls.Post.Votable.initialize.call(this, Element.select(article, 'p.relevance')[0])
		this.share = Element.select(article, 'div.share')[0]
		if (this.share) {
			this.arrow = Element.select(this.article, '.arrow')[0]
			Event.observe(window, 'scroll', this.placeShare.bind(this))
			Event.observe(window, 'resize', this.placeShare.bind(this))
		}
	},
	
	placeShare: function() {
		var scrollTop = window.pageYOffset || document.documentElement.scrollTop  || document.body.scrollTop
		var obj = this.article
		var top = obj.offsetTop
		while (obj = obj.offsetParent) {
			top += obj.offsetTop
		}
		var bottom = top + this.article.offsetHeight - this.share.offsetHeight - this.arrow.offsetHeight - 12
		if (scrollTop > top) {
			if (scrollTop < bottom) {
				this.share.style.position = 'fixed'
				this.share.style.top = '10px'
				this.share.style.right = '10px'
				this.share.style.bottom = ''
			} else {
				this.share.style.position = 'absolute'
				this.share.style.top = ''
				this.share.style.right = ''
				this.share.style.bottom = this.arrow.offsetHeight + 12 + 'px'
			}
		} else {
			this.share.style.position = 'absolute'
			this.share.style.top = '0px'
			this.share.style.right = ''
			this.share.style.bottom = ''
		}
	}
})
View.Controls.Post.Comment.Summary = Class.create(View.Controls.Post, {
	RELEVANCE_MAX_LENGTH: [128, 128, 126, 104, 104, 96, 88, 82, 76, 72],
	initialize: function(article) {
		this.article = article
		//isTopic
		this.isTopic = this.article.className.indexOf('topic') > -1
		// balloon y content
		var divs = this.article.getElementsByTagName('div')
		if (this.isTopic) {
			this.balloon = divs[0]
			this.content = divs[1]
		} else {
			this.balloon = divs[1]
			this.content = divs[2]
		}
		this.balloon.onclick = this.content.onclick = this.onClickComment.bind(this)
		this.blockquote = this.content.getElementsByTagName('blockquote')[0]
		this.loaded = !this.blockquote.hasAttribute('data-content')
		this.collapsed = this.article.className.indexOf('collapsed') > -1
		if (!this.collapsed) this.setupExtended()
		//if (this.isTopic) {
		
		var relevance = this.article.className.match(/\br(-?\d)\b/)
		relevance = relevance && parseInt(relevance[1]) || 0
		var maxLength = this.RELEVANCE_MAX_LENGTH[relevance + 3]
		
		//localizamos el TextNode del titulo
		var h = this.balloon.getElementsByTagName('h1')[0] || this.balloon.getElementsByTagName('h2')[0]
		var a = h.getElementsByTagName('a')[0]
		this.titleTextNode = a ? a.firstChild : h.lastChild
		this.originalTitle = this.titleTextNode.textContent || this.titleTextNode.data
		this.originalTitle = this.originalTitle.toString().strip()
	    if (this.originalTitle.length > maxLength) {
	      if (this.originalTitle.charAt(maxLength) == ' ')
	        this.collapsedTitle = this.originalTitle.slice(0, maxLength)
	      else if (this.originalTitle.charAt(maxLength - 1) == ' ')
	        this.collapsedTitle = this.originalTitle.slice(0, maxLength - 1)
	      else {
	        this.collapsedTitle = this.originalTitle.slice(0, maxLength).split(' ')
	        this.collapsedTitle = this.collapsedTitle[1] ? this.collapsedTitle.slice(0, -2).join(' ') : this.collapsedTitle[0]
	      }
		  this.collapsedTitle += '…'
		  this.titleTextNode[this.titleTextNode.textContent ? 'textContent' : 'data'] = this.collapsedTitle
	    }
			
		//}
	},
	
	setupExtended: function() {
		//favorite
		//this.favorite = this.balloon.getElementsByTagName('a')[0]
		//this.favorite.onclick = this.onClickFavorite.bind(this)
		//images
		this.checkImagesOverflow()
		//user icon
		this.userIcon = Element.select(this.article, '.userTx img')[0]
		if (this.userIcon.src.indexOf('anonymous') == -1) this.setUpUserIcon()
		this.extended = true
	},
	
	onClickComment: function(event) {
		event = event || window.event
		var target = Event.element(event)
		switch (target.tagName.toLowerCase()) {
			case 'a':
			case 'img':
				break
			default:
				Event.stop(event)
				if (document.selection && document.selection.createRange ? document.selection.createRange().text : getSelection().toString()) return false
				if (this.loading) return
				if (this.loaded) {
					this.collapsed ? this.collapseOpen() : this.collapseClose()
					this.flash()
				} else {
					this.loading = true
					Element.addClassName(this.balloon, 'loading')
					new Ajax.Request(this.blockquote.getAttribute('data-content'), {
						method: 'get',
			    		parameters: {authenticity_token: controller.authenticity_token, trash: Math.round(Math.random() * 99999)},
						onComplete: function(response, json) {
							Element.removeClassName(this.balloon, 'loading')
							if (json && !json.result) {
								alert(json.message)
								return
							}
							if (!response.request.success()) {
								alert('Se ha producido un error al cargar el contenido')
								return
							}
							this.loaded = true
							this.blockquote.innerHTML = response.responseText
							this.collapseOpen()
							this.flash()
							this.loading = false
						}.bind(this)
					})
				}
		}
	},
/*	
	onClickFavorite: function(event) {
		event = event || window.event
		Event.stop(event)
		this.favorite.className = this.favorite.className == 'act' ? '' : 'act'
		//to do
	},
*/	
	checkImagesOverflow: function() {
		var imgs = this.content.getElementsByTagName('img')
		if (imgs[0]) {
			var maxWidth = this.article.offsetWidth - 26 // menos el borde
			for (var i = 0, l = imgs.length; i < l; i++) {
				var img = imgs[i]
				if (img.width) {
					this.correctImageOverflow(img, maxWidth)
				} else {
					img.onload = this.correctImageOverflow.bind(this, img, maxWidth)
				}
			}
		}
	},
	
	correctImageOverflow: function(img, maxWidth) {
		if (img.width > maxWidth) {
			img.height = (maxWidth / img.width) * img.height
			img.width = maxWidth
			img.className += ' reduced'
			img.onclick = this.onClickReducedImage.bind(this, img)
		}
	},
	
	onClickReducedImage: function(img) {
		window.open(img.src, '_blank')
	},
	
	/*
	 * Expande el comentario
	 */
	collapseOpen: function() {
		this.collapsed = false
		Element.removeClassName(this.article, 'collapsed')
		if (this.collapsedTitle) this.titleTextNode[this.titleTextNode.textContent ? 'textContent' : 'data'] = this.originalTitle
		if (!this.extended) this.setupExtended()
	},
	
	/*
	 * Contrae el comentario
	 */
	collapseClose: function() {
		this.collapsed = true
		Element.addClassName(this.article, 'collapsed')
		if (this.collapsedTitle) this.titleTextNode[this.titleTextNode.textContent ? 'textContent' : 'data'] = this.collapsedTitle
	},
	
	flash: function() {
		var options = {duration: 0.4, restorecolor: '#e7e7eb'}
		if (this.effect) {
			this.effect[0].cancel()
			if (this.effect[1]) this.effect[1].cancel()
		}
		this.effect = [new Effect.Highlight(this.balloon, options)]
		if (!this.collapsed) this.effect[1] = new Effect.Highlight(this.content, options)
	}
})
View.Controls.Post.Comment.Topic = Class.create(View.Controls.Post.Comment, {
	initialize: function(parent, li, threshold, noCollapse, secondReplyAnchor) {
		this.isTopic = true
		this.isForumTopic = !parent
		this.secondReplyAnchor = secondReplyAnchor
		View.Controls.Post.Comment.prototype.initialize.call(this, parent || this, parent, li, threshold, noCollapse)
	},
	
	flash: function() {
		if (this.effect) {
			for (var i = 0; i < 4; i++) {
				var effect = this.effect[i]
				if (effect) effect.cancel()
			}
		}
		var options = {duration: 0.4, restorecolor: '#e7e7eb'}
		this.effect = [new Effect.Highlight(this.balloon, options)]
		if (!this.collapsed) {
			this.effect[1] = new Effect.Highlight(this.content, options)
			if (this.signature) this.effect[2] = new Effect.Highlight(this.signature, options)
			this.effect[3] = new Effect.Highlight(this.actions, options)
		}
	},
	
	highlight: function() {
		this.signature ? view.highlighter.start(this.balloon, this.content, this.signature, this.actions) : view.highlighter.start(this.balloon, this.content, this.actions)
	}
})
View.Controls.Post.Commentable.Story.Summary = Class.create(View.Controls.Post, View.Controls.Post.Votable, {
	initialize: function(article) {
		View.Controls.Post.Votable.initialize.call(this, Element.select(article, 'p.relevance')[0])
		//user icon
		this.userIcon = Element.select(article, '.userTx img')[0]
		if (this.userIcon.src.indexOf('anonymous') == -1) this.setUpUserIcon()
	}
})
View.Controls.SelectButton = Class.create()
Object.extend(View.Controls.SelectButton.prototype, {
	action: null,
	buttons: null,
	actionCallBack: null,
	div: null,
	controls: null,
	
	initialize: function(action, buttons, actionCallBack) {
		this.action = action
		this.buttons = buttons
		this.actionCallBack = actionCallBack
		this.controls = []
	},
	
	build: function() {
		this.div = document.createElement('div')
		this.div.className = 'selectButton'
		for (var action in this.buttons) {
			var button = document.createElement('button')
			button.setAttribute('type', 'button')
			button.title = this.buttons[action].tip
			button.className = 'tool'
			button.style.backgroundPosition = 'center -' + (24 * this.buttons[action].icon) + 'px'
			Event.observe(button, 'click', this.onClickButton.bind(this, action))
			button.action = action
			this.controls.push(button)
			this.div.appendChild(button)
		}
		return this.div
	},
	
	onClickButton: function() {
		
	}
	
})
View.Controls.Tabs = Class.create()
Object.extend(View.Controls.Tabs, {
	ON_ACTIVATE_TAB: 1,
	
	getTabOfNode: function(node) {
		var fieldSet = node.parentNode
		while (fieldSet.nodeType == 1 && (fieldSet.tagName.toLowerCase() != 'fieldset' || fieldSet.className != 'tabSet')) {
			fieldSet = fieldSet.parentNode
		}
		if (fieldSet.nodeType != 1) throw 'Node not found'
		var index = 1
		while (fieldSet.previousSibling) {
			if (fieldSet.previousSibling.nodeType == 1 && fieldSet.previousSibling.tagName.toLowerCase() == 'fieldset' && fieldSet.previousSibling.className == 'tabSet') {
				index++
			}
			fieldSet = fieldSet.previousSibling
		}
		return index
	}
})
Object.extend(View.Controls.Tabs.prototype, Observable)
Object.extend(View.Controls.Tabs.prototype, {
	initialize: function(container) {
		this.observers = [] //for Observable
		
		this.tabs = []
		this.tabSets = []
		this.active = null

		//gets natural form width and assing them to tips
		var tips = Element.select(container, 'div.tip')
		var length = tips.length
		for (var i = 0; i < length; i++) {
			var tip = tips[i]
			if (!tip.style.width) tip.style.display = 'none'
		}
		for (var i = 0; i < length; i++) {
			var tip = tips[i]
			if (!tip.style.width) {
				var parent = tip.parentNode
				tip.style.width = (view.browser.quirksMode ? parent.clientWidth - 20 : parent.clientWidth - 51) + 'px'
			}
		}
		for (var i = 0; i < length; i++) {
			tips[i].style.display = ''
		}
		//build tabs
		var tabsContainer = document.createElement('div')
		tabsContainer.className = 'tabs'
		var height = 0
		for (var i = 0; i < container.childNodes.length; i++) {
			if (container.childNodes[i].tagName && container.childNodes[i].tagName.toLowerCase() == 'fieldset' && container.childNodes[i].className == 'tabSet') {
				var fieldset = container.childNodes[i]
				this.tabSets.push(fieldset)
				var tab = document.createElement('div')
				tab.className = 'tab'
				this.tabs.push(tab)
				tab.index = this.tabs.length
				Event.observe(tab, 'click', function(event) {
					this.activate(Event.element(event || window.event).index)
				}.bind(this))
				//tab caption
				var caption
				var legend = fieldset.getElementsByTagName('legend')[0]
				if (legend && legend.parentNode == fieldset) {
					caption = legend.firstChild.nodeValue
					fieldset.removeChild(legend)
				} else {
					caption = _('Tab') + ' ' + (this.tabs.length + 1)
				}
				tab.appendChild(document.createTextNode(caption))
				tabsContainer.appendChild(tab)
				if (fieldset.offsetHeight > height) height = fieldset.offsetHeight
			}
		}
		var span = document.createElement('div')
		span.className = 'span'
		tabsContainer.appendChild(span)
		this.tabSets[0].parentNode.insertBefore(tabsContainer, this.tabSets[0])
		container.style.width = container.offsetWidth + 'px'
		height = (view.browser.quirksMode ? height : height - 22) + 'px'
		for (var i = 0, l = this.tabSets.length; i < l; i++) {
			this.tabSets[i].style.height = height
		}
		this.activate(1)
		
		var width = 0
		for (var i = 0; i < this.tabs.length; i++) {
			width += this.tabs[i].offsetWidth
		}
		span.style.width = (tabsContainer.offsetWidth - width) + 'px'
		span.style.height = (view.browser.quirksMode ? this.tabs[0].offsetHeight : this.tabs[0].offsetHeight - 1) + 'px'	
	},
	
	activate: function(index) {
		if (index < 1) {
			index = 1
		} else if (index > this.tabs.length) {
			index = this.tabs.length
		}
		if (index == this.active) {
			return
		}
		for (var i = 0; i < this.tabs.length; i++) {
			if (i == index - 1) {
				this.tabs[i].className = 'actTab'
				Element.show(this.tabSets[i])
			} else {
				this.tabs[i].className = 'tab'
				Element.hide(this.tabSets[i])
			}
		}
		this.active = index
		var firstElement = Form.findFirstElement(this.tabSets[this.active - 1])
		if (firstElement) {
			Field.activate(firstElement)
		}
		this.notifyEventToObservers(View.Controls.Tabs.ON_ACTIVATE_TAB, index)
	},
	
	getActive: function() {
		return this.active
	}
})
View.Controls.WymEditor = Class.create({
	validTags: {p:1,br:1,strong:1,em:1,strike:1,ul:1,ol:1,li:1,h2:1,h3:1,blockquote:1,pre:1,a:{href:'validate_protocol',rel:1,'class':['blank']},img:{src:'validate_protocol','class':['left','center','right','border','zoom'],style:1,width:1,height:1,id:1,title:1,alt:1},table:1,thead:1,tbody:1,tr:1,th:1,td:1,hr:1,object:{width:1,height:1,type:1,data:1,classid:1},param:{name:1,value:1},embed:{src:'validate_protocol',type:1,width:1,height:1,allowscriptaccess:1},iframe:{width:[320,1280],height:[240,720],src:'validate_iframe_src'}},
	
	/*
	 * options
	 * emoticons => true|false
	 * 
	 * Utiliza attachments si encuentra un campo llamado igual que el textArea más '_attachments'
	 */	
	initialize: function(textArea, options) {
		this.textArea = typeof textArea == 'string' ? document.getElementById(textArea) || document.getElementsByName(textArea)[0] : textArea
		this.options = options || {}
		if (!this.options.mode) this.options.mode = 'commentable'
		
		this.focus = this.focus.bind(this)
		
		var div = new Element('div', {'class': 'wymEditor'})
		div.style.width = this.textArea.offsetWidth + 'px'
		Element.insert(this.textArea, {after: div})
		
		this.editPage = new View.Controls.WymEditor.EditPage(this)
		this.sourcePage = new View.Controls.WymEditor.SourcePage(this)
		var previewPage = new View.Controls.WymEditor.PreviewPage(this)
		this.tabs = new View.Controls.WymEditor.Tabs(this.editPage, this.sourcePage, previewPage)

		div.appendChild(this.tabs.build())
		div.appendChild(this.editPage.build())
		div.appendChild(this.sourcePage.build())
		div.appendChild(previewPage.build())
		Element.hide(this.textArea)
		
		this.textArea.focus = this.onFocusTextArea.bind(this)
		Event.observe(this.textArea.form, 'submit', this.onSubmitForm.bind(this))

		this.tabs.activate('edit')
	},

	onFocusTextArea: function() {
		this.focus()
	},
	
	onSubmitForm: function() {
		this.synchronizeOut()
	},
	
	getHtml: function() {
		this.synchronizeOut()
		return this.textArea.value
	},
	
	synchronizeOut: function() {
		switch (this.tabs.active) {
			case 'edit':
				this.editPage.synchronizeOut()
				break
			case 'source':
				this.sourcePage.synchronizeOut()
		}
	},
	
	focus: function() {
		var win = this.editPage.editor.iframe.contentWindow
		if (!(win.document.body && win.document.body.hasChildNodes())) {
			setTimeout(this.focus, 100)
			return
		}
		this.tabs.activate('edit')
		this.editPage.editor.focus()
	},
	
	reset: function() {
		this.editPage.editor.synchronizeIn()
	},
	
	tidy: function() {
		
	},
	
	/*
	 * Convierte los códigos de emoticonos a imagenes
	 */
	emoToImg: function(html) {
		var emoticons = this.editPage.toolBar.emoticonPicker.emoticons
		for (var emo in emoticons) {
			html = html.replace(new RegExp('(\\s|>)' + RegExp.escape(emo) + "(\\s|<)", 'g'), '$1<img src="/images/emo/' + emoticons[emo][1] + '.gif" class="emo"/>$2')
		}
		return html
	},
	
	/*
	 * Convierte las imagenes de emoticonos a codigos
	 */
	imgToEmo: function(html) {
		var matches = html.match(/<img[^>]+src *= *"?[^"]*\/images\/emo\/(\d{1,2})\.gif[^>]*>/gi)
		if (matches) {
			for (var i = 0, l = matches.length; i < l; i++) {
				var img = matches[i]
				var index = img.match(/\/(\d{1,2})\.gif/)[1]
				html = html.replace(img, this.editPage.toolBar.emoticonPicker.emoticonsReady[index])
			}
		}
		return html
	},
	
	elementToHTML: function(parent, tabs) {
		if (Prototype.Browser.IE) return parent.innerHTML
		if (!tabs) tabs = ''
		var dtd = this.editPage.editor.dtd
		var parts = []
		var part = ''
		for (var i = 0, l = parent.childNodes.length; i < l; i++) {
			var child = parent.childNodes[i]
			switch (child.nodeType) {
				case 1: //Element
					var tagName = child.tagName.toLowerCase()
					var pc = dtd.elements[tagName] && (!dtd.elements[tagName].content || dtd.blockElement(tagName))
					if (part && pc) {
						parts.push(part)
						part = ''
					}
					part += '<' + tagName
					if (child.hasAttributes()) {
						attributes = []
						for (var j = 0, m = child.attributes.length; j < m; j++) {
							var attribute = child.attributes[j]
							attributes.push(attribute.name + '="' + attribute.value + '"')
						}
						part += ' ' + attributes.join(' ')
					}
					if (child.hasChildNodes()) {
						part += '>'
						//if (pc) part += '\n' //+ tabs + '\t'
						part += this.elementToHTML(child)//, tabs + '\t')
						//if (pc) part += '\n' //+ tabs
						part += '</' + tagName + '>'
						//if (pc) html += '\n'
					} else {
						part += '/>'
					}
					//if (dtd.blockElement(tagName)) html += '\n'
					break
				case 3: //TextNode
					if (parent.tagName.toLowerCase() == 'pre') part += child.nodeValue
					else part += child.nodeValue.replace(/\s+/g, ' ')
					break
				case 8: //CommentNode
					part += '<!--' + child.nodeValue + '-->'
					break
				default:
					alert('not implemented')
			}
		}
		if (part) parts.push(part)
		
		return parts.join('\n')
	},
	
	filterElements: function(parent) {
		for (var i = 0; i < parent.childNodes.length; i++) {
			var node = parent.childNodes[i]
			switch (node.nodeType) {
				case 1:
					if (node.hasChildNodes()) this.filterElements(node)
					var tag = node.tagName.toLowerCase()
					switch (tag) {
						case 'b':
							tag = 'strong'
							break
						case 'i':
							tag = 'em'
					}
					if (!this.validTags[tag]) {
						switch (tag) {
							//tags de los que no hay que conservar los hijos
							case 'script':
							case 'style':
								break
							default:
							var child
							while (child = node.firstChild) {
								node.removeChild(child)
								node.parentNode.insertBefore(child, node)
							}
						}
						node.parentNode.removeChild(node)
						continue
					}
					for (var j = 0; j < node.attributes.length; j++) {
						this.filterAttribute(node, tag, node.attributes[j])
					}
					break
				case 3:
					if (parent.tagName.toLowerCase() == 'pre') continue
					if (!node.nodeValue.length) {
						node.parentNode.removeChild(node)
						continue
					}
					node.nodeValue = node.nodeValue.replace(/\s+/g, ' ')
			}
		}

	},
	
	filterAttribute: function(node, tag, attr) {
		if (!this.validTags[tag][attr.name]) {
			node.removeAttribute(attr.name)
			return
		}
		switch (attr.name) {
			case 'class':
				var classes = attr.value.strip().split(/\s+/)
				for (var i = 0; i < classes.length;) {
					//optimizar
					if ($A(this.validTags[tag]['class']).include(classes[i])) {
						i++
					} else {
						classes.splice(i, 1)
					}
				}
				if (!classes.length) {
					node.removeAttribute(attr.name)
					return
				}
				node.setAttribute(attr.name, classes.join(' '))
		}
		// protocol
		
	}/*
,
	
	linkUrls: function(html) {
		
		/<a[^>]*>.*?<\/a>/gim
		var matches = html.match(/(?:^|\s)[a-z]{3,4}:\/\/[^\s<]+/gi)
		if (matches) {
			for (var i = 0, l = matches.length; i < l; i++) {
				var img = matches[i]
				var index = img.match(/\/(\d{1,2})\.gif/)[1]
				html = html.replace(img, this.editPage.toolBar.emoticonPicker.emoticonsReady[index])
			}
		}
	}
*/
})
View.Controls.WymEditor.EditPage = Class.create({
	initialize: function(wymEditor) {
		this.wymEditor = wymEditor
		
		this.toolBar = new View.Controls.WymEditor.EditPage.ToolBar(this)
		this.editor = new View.Controls.WymEditor.EditPage.Editor(this)
		this.attributesBar = new View.Controls.WymEditor.EditPage.AttributesBar(this)
	},
	
	build: function(width) {
		this.pageDiv = new Element('div', {'class': 'page edit'})
		Element.hide(this.pageDiv)
		this.pageDiv.appendChild(this.toolBar.build())
		this.pageDiv.appendChild(this.editor.build())
		this.pageDiv.appendChild(this.attributesBar.build())
		
		return this.pageDiv
	},
	
	show: function() {
		Element.show(this.pageDiv)
		this.editor.synchronizeIn()
		this.editor.focus()
	},
	
	hide: function() {
		Element.hide(this.pageDiv)
		this.editor.synchronizeOut()
	},
	
	synchronizeOut: function() {	
		this.editor.synchronizeOut()
	}
})
View.Controls.WymEditor.Layoutable = {
	buildLayout: function() {
		for (var i = 0, l = this.layout.length; i < l; i++) {
			var itemName = this.layout[i]
			switch (itemName) {
				case ' ':
					this.div.appendChild(document.createTextNode(' '))
					break
				case '\n':
					this.div.appendChild(document.createElement('br'))
					break
				default:
					var item = this.layoutItems[itemName]
					switch (item.type) {
						case 'text':
							var label = document.createElement('label')
							label.appendChild(document.createTextNode(item.caption + ' '))
							var input = document.createElement('input')
							input.setAttribute('type', 'text')
							input.title = item.tip
							input.action = itemName
							input.className = 'text'
							if (item.size) input.size = item.size
							if (item.maxlength) input.maxlength = item.maxlength
							var name = itemName.substr(0, 1).toUpperCase() + itemName.substr(1)
							if (this['onFocus' + name]) Event.observe(input, 'focus', this['onFocus' + name].bind(this))
							if (this['onKeyUp' + name]) Event.observe(input, 'keyup', this['onKeyUp' + name].bind(this))
							if (this['onKeyPress' + name]) Event.observe(input, 'keypress', this['onKeyPress' + name].bind(this))
							if (this['onBlur' + name]) Event.observe(input, 'blur', this['onBlur' + name].bind(this))
							this.controls[itemName] = input
							label.appendChild(input)
							this.div.appendChild(label)
							break
							
						case 'button':
						default:
							var button = document.createElement('button')
							button.setAttribute('type', 'button')
							if (item.tip) button.title = item.tip
							button.className = 'tool'
							button.style.backgroundPosition = 'center -' + (20 * item.icon) + 'px'
							Event.observe(button, 'click', this.action.bind(this, button))
							button.action = itemName
							this.controls[itemName] = button
							this.div.appendChild(button)
							if (view.browser.quirksMode) {
								//button.style.width = '24px'
								//button.style.height = '24px'
							}
					}
			}
		}
	}
}
View.Controls.WymEditor.PreviewPage = Class.create()
Object.extend(View.Controls.WymEditor.PreviewPage.prototype, {
	wymEditor: null,
	pageDiv: null,
	iframe: null,
	
	initialize: function(wymEditor) {
		this.wymEditor = wymEditor
	},
	
	build: function() {
		this.pageDiv = new Element('div', {'class': 'page preview'})
		Element.hide(this.pageDiv)
		this.iframe = new Element('iframe', {src: 'about:blank'})
		var textArea = this.wymEditor.textArea
		this.iframe.setStyle({width: (view.browser.quirksMode ? textArea.offsetWidth : textArea.offsetWidth - 4) + 'px', height: (view.browser.quirksMode ? textArea.offsetHeight : textArea.offsetHeight - 4) + 'px'})
		setTimeout(function() {
			var document = this.iframe.contentWindow.document
			document.open()
			document.write('<html><head><link rel="stylesheet" type="text/css" href="/stylesheets/wym_editor.css?' + Math.round(999999 * Math.random()) + '" /></head><body id="preview" class="' + this.wymEditor.options.mode + '"></body></html>')
			document.close()
		}.bind(this), 100)
		
		this.pageDiv.appendChild(this.iframe)
		
		return this.pageDiv
	},
	
	show: function() {
		this.iframe.contentWindow.document.body.innerHTML = this.wymEditor.emoToImg(this.wymEditor.textArea.value)
		Element.show(this.pageDiv)
	},
	
	hide: function() {
		Element.hide(this.pageDiv)
	}
})
View.Controls.WymEditor.SourcePage = Class.create()
Object.extend(View.Controls.WymEditor.SourcePage.prototype, {
	wymEditor: null,
	pageDiv: null,
	textArea: null,
	
	initialize: function(wymEditor) {
		this.wymEditor = wymEditor
	},
	
	build: function() {
		this.pageDiv = new Element('div', {'class': 'page source'})
		Element.hide(this.pageDiv)
		
		this.textArea = new Element('textarea')
		var textArea = this.wymEditor.textArea
		Element.setStyle(this.textArea, {width: (view.browser.quirksMode ? textArea.offsetWidth : textArea.offsetWidth - 4) + 'px', height: (view.browser.quirksMode ? textArea.offsetHeight - 2 : textArea.offsetHeight - 4) + 'px'})
		Event.observe(this.textArea, 'keypress', this.onKeyPress.bind(this))
		this.pageDiv.appendChild(this.textArea)
		
		return this.pageDiv
	},
	
	show: function() {
		this.textArea.value = this.wymEditor.textArea.value
		Element.show(this.pageDiv)
		this.textArea.focus()
	},
	
	hide: function() {
		Element.hide(this.pageDiv)
		this.synchronizeOut()
	},
	
	synchronizeOut: function() {	
		var div = document.createElement('div')
		div.innerHTML = this.textArea.value
		this.wymEditor.filterElements(div)
		this.wymEditor.textArea.value = this.wymEditor.elementToHTML(div)
		Event.fire(this.wymEditor.textArea, 'change')
	},
	
	onKeyPress: function(event) {
		var event = event || window.event
		switch (event.keyCode) {
			case Event.KEY_TAB:
				Event.stop(event)
		}
	}
})
View.Controls.WymEditor.Tabs = Class.create({
	tabs: {
		edit: {caption: 'Editar'},
		source: {caption: 'Código'},
		preview: {caption: 'Previsualizar'}
	},
	
	initialize: function(editPage, sourcePage, previewPage) {
		this.editPage = editPage
		this.sourcePage = sourcePage
		this.previewPage = previewPage
		this.spans = {}
	},
	
	build: function() {
		//build tabs bar
		var div = new Element('div', {'class': 'tabs'})
		for (var name in this.tabs) {
			var tab = this.tabs[name]
			var span = new Element('span', {'class': 'name'}).update(tab.caption)
			Event.observe(span, 'click', this['onClickTab'].bind(this, name))
			div.appendChild(span)
			this.spans[name] = span
		}
		return div
	},
	
	activate: function(name) {
		if (this.active) {
			if (name == this.active) return false
			Element.removeClassName(this.spans[this.active], 'act')
			this[this.active + 'Page'].hide()
		}
		Element.addClassName(this.spans[name], 'act')
		this[name + 'Page'].show()
		this.active = name
	},
	
	onClickTab: function(name) {
		this.activate(name)
	}
})
View.Controls.WymEditor.EditPage.AttributesBar = Class.create({
	initialize: function(editPage) {
		this.editPage = editPage
	},
	
	build: function() {
		var div = document.createElement('div')
		div.className = 'attributesBar'
		this.attributes = {
			table: new View.Controls.WymEditor.EditPage.AttributesBar.TableAttributes(this),
			list: new View.Controls.WymEditor.EditPage.AttributesBar.ListAttributes(this),
			anchor: new View.Controls.WymEditor.EditPage.AttributesBar.AnchorAttributes(this),
			image: new View.Controls.WymEditor.EditPage.AttributesBar.ImageAttributes(this)
		}
		div.appendChild(this.attributes.table.build())
		div.appendChild(this.attributes.list.build())
		div.appendChild(this.attributes.anchor.build())
		div.appendChild(this.attributes.image.build())
		return div
	},
	
	update: function() {
		var objSelection = this.editPage.editor.selection, selection = objSelection.selection(), types = []
		if (objSelection.inPath('tr')) types.push('table')
		if (objSelection.inPath('ul', 'ol')) types.push('list')
		if (objSelection.inPath('a')) types.push('anchor')
		if (Prototype.Browser.IE) {
			var range = selection.createRange()
			if (range.item) {
				var item = range.item()
				if (item.tagName == 'IMG' && item.className != 'emo') types.push('image')
			}
		} else if (selection.anchorNode == selection.focusNode && selection.anchorNode.nodeType == 1 && selection.focusOffset - selection.anchorOffset == 1) {
			var child = selection.getRangeAt(0).cloneContents().childNodes[0]
			if (child.tagName == 'IMG' && child.className != 'emo') types.push('image')
		}
		for (var type in this.attributes) {
			var found = false
			for (var i = 0, l = types.length; i < l; i++) {
				if (types[i] == type) {
					found = true
					break
				}
			}
			if (found) {
				this.attributes[type].update()
				this.attributes[type].show()
			} else {
				this.attributes[type].hide()
			}
		}
	}
})
//http://help.dottoro.com/ljcvtcaw.php#supByObj
//http://help.dottoro.com/larpvnhw.php
View.Controls.WymEditor.EditPage.Editor = Class.create({
	initialize: function(editPage) {
		this.editPage = editPage
		this.selection = new View.Controls.WymEditor.EditPage.Editor.Selection(this)
		this.dtd = new View.Controls.WymEditor.EditPage.Editor.DTD(this)
		this.initIframe = this.initIframe.bind(this)
		this.dropImage = this.dropImage.bind(this)
		this.backup = this.backup.bind(this)
	},
	
	build: function() {
		var textArea = this.editPage.wymEditor.textArea
		this.iframe = new Element('iframe', {src: 'about:blank'})
		Element.setStyle(this.iframe, {width: (view.browser.quirksMode ? textArea.offsetWidth : textArea.offsetWidth - 4) + 'px', height: (view.browser.quirksMode ? textArea.offsetHeight : textArea.offsetHeight - 4) + 'px'})
		Event.observe(this.iframe, 'load', function() {
			if (this.initialized) return
			this.initialized = true
			var document = this.iframe.contentWindow.document
			document.open()
			document.write('<html><head><link rel=stylesheet type=text/css href=/stylesheets/wym_editor.css?' + Math.round(999999 * Math.random()) + '></head><body id=editor class=' + this.editPage.wymEditor.options.mode + '></body></html>')
			document.close()
			document.designMode = 'on'
			setTimeout(this.initIframe, 50)
		}.bind(this))
		
		return this.iframe
	},
	
	initIframe: function() {
		if (!this.iframe.contentWindow.document.body) {
			setTimeout(this.initIframe, 50)
			return
		}
		var document = this.iframe.contentWindow.document // necesario para IE
		Event.observe(document, 'keyup', this.onKeyPress.bind(this))
		Event.observe(document, 'mouseup', this.onEvent.bind(this))
		if (Prototype.Browser.IE) {
			Event.observe(document.documentElement, 'drop', this.onEvent.bind(this))
		} else {
			Event.observe(document.documentElement, 'dragover', this.onEvent.bind(this))
			Event.observe(document.documentElement, 'dragdrop', this.onEvent.bind(this))
		}
		//el evento onBlur solo va en IE, lo que nos viene bien para memorizar la selección actual
		if (Prototype.Browser.IE) Event.observe(this.iframe.contentWindow, 'blur', this.onEvent.bind(this))
		this.synchronizeIn()
		//hay una copia de backup?
		var backup = this.editPage.wymEditor.options.backup
		if (backup) {
			if (backup.exists && confirm('Hay una copia de seguridad del contenido que no llegaste a enviar ¿Quieres recuperarla?')) {
				new Ajax.Request(backup.url, {
					method: 'get',
		    		parameters: {authenticity_token: controller.authenticity_token, trash: Math.round(Math.random() * 99999)},
					onComplete: function(response, json) {
						if (!response.request.success() || !json || !json.result) {
							alert('Ha sido imposible recuperar la copia de seguridad')
							return
						}
						this.iframe.contentWindow.document.body.innerHTML = this.toCheatHtml(json.content)
					}.bind(this)
				})
			}
			this.lastBackupTime = new Date().getTime()
		}
	},
	
	synchronizeIn: function() {
		if (this.initialized) {
			this.iframe.contentWindow.document.body.innerHTML = this.toCheatHtml(this.editPage.wymEditor.textArea.value)
		}
	},
	
	synchronizeOut: function() {
		var wymEditor = this.editPage.wymEditor
		wymEditor.filterElements(this.iframe.contentWindow.document.body)
		wymEditor.textArea.value = this.toRightHtml(wymEditor.elementToHTML(this.iframe.contentWindow.document.body))
		Event.fire(wymEditor.textArea, 'change')
	},
	
	focus: function() {
		this.iframe.contentWindow.focus()
	},
	
	onEvent: function(event) {
		this.selection.normalize()
		var event = event || window.event
		switch (event.type) {
			case 'dragover':
				if (!this.editPage.toolBar.imagePicker.thumbnails.isDragging()) Event.stop(event)
				break
			case 'drop':
			case 'dragdrop':
				if (this.editPage.toolBar.imagePicker.thumbnails.isDragging()) {
					this.dropImage()
				} else {
					Event.stop(event)
				}
				return false
				break
			case 'blur': // solo esta capturado en IE
				this.selection.memo()
				return
				break
		}
		this.editPage.toolBar.update()
		this.editPage.attributesBar.update()
		if (this.editPage.wymEditor.options.backup) this.fireBackup()
	},
	
	onKeyPress: function(event) {
		this.selection.normalize()
		var event = event || window.event
		var document = this.iframe.contentWindow.document
		switch (event.keyCode) {
			case 13:
				//Al apretar [Enter] dentro de un parrafo vacío, Mozilla crea un nuevo parrafo, pero añade un BR sobre el parrafo original
				// <br>	<-- BR molesto
				// <p><br></p> <-- parrafo original
				// <p><br></p> <-- nuevo parrafo
				var parent = this.selection.parent()
				if (parent == document.body) {
					
				}
				if (parent.parentNode == document.body && parent.tagName == 'P') {
					var br = parent.previousSibling
					if (br) {
						br = br.previousSibling
						if (br && br.tagName == 'BR') br.parentNode.removeChild(br)
					}
				}
				break
			default:
				// Si se escribe fuera de un P, lo envolvemos con uno
				var parent = this.selection.parent(true)
				if (parent.nodeType == 3 && parent.parentNode == document.body && parent.nodeValue) {
					document.execCommand('formatBlock', false, '<p>')
				}
		}
		this.editPage.toolBar.update()
		this.editPage.attributesBar.update()
		if (this.editPage.wymEditor.options.backup) this.fireBackup()
	},
	
	fireBackup: function() {
		clearTimeout(this.backupTimeout)
		this.backupTimeout = setTimeout(this.backup, 4000)
	},
	
	backup: function() {
		var now = new Date().getTime()
		if (now - this.lastBackupTime > 10000) {
			var content = this.iframe.contentWindow.document.body.innerHTML
			if (content.length < 250) return
			this.lastBackupTime = now
			new Ajax.Request(this.editPage.wymEditor.options.backup.url, {
	    		parameters: {authenticity_token: controller.authenticity_token, content: content}
			})
		}
	},
	
	execCommand: function(command, value) {
		this.selection.restore()
		this.selection.normalize()
		var document = this.iframe.contentWindow.document
		try { document.execCommand('styleWithCSS', false, false) } catch(e) {} //no soportado por IE
		switch (command) {				
			case 'strong':
				document.execCommand('bold', false, null)
				break
			case 'emphasized':
				document.execCommand('italic', false, null)
				break
			case 'erased':
				document.execCommand('strikeThrough', false, null)
				break
				
			case 'unorderedList':
				var un = document.queryCommandState('insertUnorderedList')
				document.execCommand('insertUnorderedList', false, true)
				if (un) document.execCommand('formatBlock', false, '<p>')
				break
			case 'orderedList':
				var un = document.queryCommandState('insertOrderedList')
				document.execCommand('insertOrderedList', false, true)
				if (un) document.execCommand('formatBlock', false, '<p>')
				break
			case 'outdent':
				document.execCommand('outdent', false, true)
				if (this.selection.parent() == document.body) document.execCommand('formatBlock', false, '<p>')
				break
			case 'indent':
				document.execCommand('indent', false, true)
				break
				
			case 'header2':
			case 'header3':
				if (this.queryCommandState(command)) {
					document.execCommand('formatBlock', false, '<p>')
				} else {
					document.execCommand('formatBlock', false, '<h' + command.substr(6, 1) + '>')
				}
				break
				
			case 'quote':
				if (this.queryCommandState('quote')) {
					document.execCommand('outdent', false, true)
				} else {
					document.execCommand('indent', false, true) //document.execCommand('formatBlock', false, 'blockquote')
				}
				break
				
			case 'code':
				if (this.queryCommandState('code')) {
					document.execCommand('formatBlock', false, '<p>')
				} else {
					document.execCommand('formatBlock', false, '<pre>')
				}
				break
				
			case 'anchor':
				var anchor = this.selection.inPath('a')
				if (anchor) {
					this.selection.select(anchor)
					document.execCommand('unlink', false, null)
				} else {
					if (this.selection.collapsed()) {
						alert('Selecciona primero el texto que deseas enlazar')
						return false
					}
					document.execCommand('createLink', false, '#')
					this.selection.normalize()
					this.editPage.toolBar.update()
					this.editPage.attributesBar.update()
					this.editPage.attributesBar.attributes['anchor'].anchor = this.selection.inPath('a')
					setTimeout(function() { this.editPage.attributesBar.attributes['anchor'].focus('anchorHref') }.bind(this), 100)
					return true
				}
				break
			case 'anchorBlank':
				var anchor = this.selection.inPath('a')
				//this.selection.select(anchor)
				Element.hasClassName(anchor, 'blank') ? Element.removeClassName(anchor, 'blank') : anchor.className += (anchor.className ? ' ' : '') + 'blank'
				break
			
			// images
			case 'image':
				var url = prompt('URL de la imágen (En internet, ¡¡NO EN TU DISCO DURO!!)', '')
				if (url) document.execCommand('insertImage', false, url)
				break
			case 'imageLeft':
			case 'imageCenter':
			case 'imageRight':
				var img = this.selection.getElements('img')[0]
				var className = command.substr(5).toLowerCase()
				var align = Element.hasClassName(img, className)
				Element.removeClassName(img, 'left')
				Element.removeClassName(img, 'center')
				Element.removeClassName(img, 'right')
				if (!align) img.className += (img.className ? ' ' : '') + className;
				break
			case 'imageBorder':
				var img = this.selection.getElements('img')[0]
				Element.hasClassName(img, 'border') ? Element.removeClassName(img, 'border') : img.className += (img.className ? ' ' : '') + 'border'
				break
			case 'imageZoom':
				var img = this.selection.getElements('img')[0]
				Element.hasClassName(img, 'zoom') ? Element.removeClassName(img, 'zoom') : img.className += (img.className ? ' ' : '') + 'zoom'
				break
				
			//tables
			case 'table':
				var table = this.selection.inPath('table')
				if (table) {
					table.parentNode.removeChild(table)
				} else {
					//creamos la tabla
					var document = this.iframe.contentWindow.document
					table = document.createElement('table')
					for (var i = 0; i < 2; i++) {
						var row = table.insertRow(i)
						for (var j = 0; j < 2; j++) {
							var cell = row.insertCell(j)
							if (!Prototype.Browser.IE) cell.appendChild(document.createElement('br'))
						}
					}
					//buscamos el nodo ascendiente que sea hijo directo del body
					//lo utilizaremos para insertar la tabla justo a continuación suya
					var parent = this.selection.parent()
					if (parent == document.body) {
						this.selection.insert(table)
					} else {	
						while (parent.parentNode != document.body) {
							parent = parent.parentNode
						}
						Element.insertAfter(table, parent)
					}
					this.selection.select(table.rows[0].cells[0])
				}
				break
			case 'tableAddBRow':
			case 'tableAddTRow':
				//TO DO: soportar los rowSpan
				var table = this.selection.inPath('table')
				var selCell = this.selection.inPath('td', 'th')
				var selRow = selCell.parentNode
				var selCellGridIndex = this.getGridIndexOfCell(selCell)
				//averiguamos el máximo número de columnas que tiene la tabla
				var cols = 0
				for (var i = 0, l = table.rows.length; i < l; i++) {
					var row = table.rows[i]
					var length = 0
					for (var j = 0, m = row.cells.length; j < m; j++) length += row.cells[j].colSpan
					if (length > cols) cols = length
				}
				var row = table.insertRow(selRow.rowIndex + (command == 'tableAddTRow' ? 0 : 1))
				for (var i = 0; i < cols; i++) {
					var cell = row.insertCell(i)
					if (!Prototype.Browser.IE) cell.appendChild(document.createElement('br'))
				}
				this.selection.select(this.getCellAtGridIndex(row, selCellGridIndex))
				break
			case 'tableAddLCol':
			case 'tableAddRCol':
				var table = this.selection.inPath('table')
				var selCell = this.selection.inPath('td', 'th')
				var selRow = selCell.parentNode
				var gridIndex = this.getGridIndexOfCell(selCell) + (command == 'tableAddLCol' ? 0 : selCell.colSpan)
				for (var i = 0, l = table.rows.length; i < l; i++) {
					var row = table.rows[i]
					var cell = this.getCellAtGridIndex(row, gridIndex)
					var index = cell ? cell.cellIndex : row.cells.length
					cell = row.insertCell(index)
					if (!Prototype.Browser.IE) cell.appendChild(document.createElement('br'))
				}
				this.selection.select(this.getCellAtGridIndex(selRow, gridIndex))
				break
			case 'tableDelRow':
				var table = this.selection.inPath('table')
				var selCell = this.selection.inPath('td', 'th')
				var rowIndex = selCell.parentNode.rowIndex
				table.deleteRow(rowIndex)
				if (rowIndex == table.rows.length) rowIndex--
				var row = table.rows[rowIndex]
				this.selection.select(this.getCellAtGridIndex(row, this.getGridIndexOfCell(selCell)) || row.cells[row.cells.length - 1])
				break
			case 'tableDelCol':
				var table = this.selection.inPath('table')
				var selCell = this.selection.inPath('td', 'th')
				var selRow = selCell.parentNode
				var selCellGridIndex = this.getGridIndexOfCell(selCell)
				for (var i = 0; i < table.rows.length; i++) {
					var row = table.rows[i]
					var cell = this.getCellAtGridIndex(row, selCellGridIndex)
					if (cell) {
						if (cell.colSpan > 1) {
							cell.colSpan--
						} else if (row.cells.length > 1) {
							row.deleteCell(cell.cellIndex)
						} else {
							table.deleteRow(i)
							i--
						}
					}
				}
				this.selection.select(this.getCellAtGridIndex(selRow, selCellGridIndex) || selRow.cells[selRow.cells.length - 1])
				break
			case 'tableHeader':
				var oldCell = this.selection.inPath('td', 'th')
				var newCell = document.createElement(oldCell.tagName.toLowerCase() == 'td' ? 'th' : 'td')
				var child
				while (child = oldCell.firstChild) {
					newCell.appendChild(child)
				}
				oldCell.parentNode.replaceChild(newCell, oldCell)
				this.selection.select(newCell)
				break
				
			case 'separator':
				document.execCommand('InsertHorizontalRule', false, null)
				break
				
			case 'html':
				var html = prompt('Código HTML a insertar', '')
				if (html) {
					//http://youtu.be/xMi568yAJXk
					//http://www.youtube.com/watch?v=xMi568yAJXk
					//http://www.youtube.com/watch?feature=player_detailpage&v=xMi568yAJXk#t=17s
					var matches = html.match(/^http:\/\/youtu\.be\/([-_\da-zA-Z]+)/) || html.match(/^http:\/\/www\.youtube.com\/watch\?.*?\bv=([-_\da-zA-Z]+)/)
					if(matches) html = '<iframe width=480 height=360 src="http://www.youtube.com/embed/' + matches[1] + '?rel=0"></iframe>'
					this.selection.insert(html)
				}
				break
				
			case 'emoticon':
				this.selection.insert(' <img src="/images/emo/' + value + '.gif" class="emo"/> ')
				break
				
			case 'clean':
				document.execCommand('removeFormat', false, null)
				document.execCommand('formatBlock', false, '<p>')
				document.execCommand('unlink', false, null)
				this.editPage.wymEditor.filterElements(this.selection.parent())
				break
				
			default:
				throw("Unsupported command '" + command + "'")
			
		}
		this.selection.normalize()
		this.editPage.toolBar.update()
		this.editPage.attributesBar.update()
		this.focus()
	},
	
	queryCommandEnabled: function(command) {
		var result = false
		var document = this.iframe.contentWindow.document
		switch (command) {
			case 'indent':
				var list = this.selection.inPath('ul', 'ol')
				result = list && list.childNodes.length > 1
				break
			case 'outdent':
				result = document.queryCommandState('insertUnorderedList') || document.queryCommandState('insertOrderedList')
				break
				
			case 'tableDelRow':
				var table = this.selection.inPath('table')
				result = table && table.rows.length > 1 ? true : false
				break
			case 'tableDelCol':
				var tr = this.selection.inPath('tr')
				result = tr && tr.cells.length > 1 ? true : false
				break
			case 'tableHeader':
				var tr = this.selection.inPath('tr')
				result = tr && !tr.rowIndex
				break
				
			default:
				throw("Unsupported queryCommandEnabled command '" + command + "'")
		}
		return result
	},
	
	queryCommandState: function(command) {
		var result = false
		var document = this.iframe.contentWindow.document
		switch (command) {
			case 'strong':
				result = document.queryCommandState('bold')
				break
			case 'emphasized':
				result = document.queryCommandState('italic')
				break
			case 'erased':
				result = document.queryCommandState('strikeThrough')
				break
				
			case 'unorderedList':
				result = document.queryCommandState('insertUnorderedList')
				break
			case 'orderedList':
				result = document.queryCommandState('insertOrderedList')
				break
				
			case 'header2':
			case 'header3':
				result = this.selection.inPath('h' + command.substr(6, 1)) //this.queryCommandState(command)
				break
				
			case 'quote':
				result = this.selection.inPath('blockquote')
				break
			case 'code':
				result = this.selection.inPath('pre')
				break
					
			//anchors
			case 'anchor':
				result = this.selection.inPath('a')// || this.selection.getElements('a')[0]
				break
			case 'anchorHref':
				var a = this.selection.inPath('a') || this.selection.getElements('a')[0]
				if (a) result = a.getAttribute('href')
				break
			case 'anchorBlank':
				var a = this.selection.inPath('a') || this.selection.getElements('a')[0]
				if (a) result = Element.hasClassName(a, 'blank')
				break
				
			//image
			case 'imageLeft':
			case 'imageCenter':
			case 'imageRight':
			case 'imageBorder':
			case 'imageZoom':
				var className = command.substr(5).toLowerCase()
				var img = this.selection.getElements('img')[0]
				if (img) result = Element.hasClassName(img, className)
				break			
							
			//tables
			case 'table':
				result = this.selection.inPath('table')
				break
			case 'tableHeader':
				result = this.selection.inPath('th')
				break
				
			default:
				throw("Unsupported queryCommandState command '" + command + "'")
		}
		return result
	},
	
	queryCommandValue: function(command) {
		var result = null
		var document = this.iframe.contentWindow.document
		switch (command) {
			case 'anchorHref':
				var a = this.selection.inPath('a')
				if (a) result = a.getAttribute('href')
				break
				
			case 'imageName':
				var img = this.selection.getElements('img')[0]
				if (img) result = img.getAttribute('alt')
				break
				
			default:
				throw("Unsupported queryCommandValue command '" + command + "'")
		}
		return result
	},
	
	toCheatHtml: function(html) {
		if (html.strip() == '') return '<p><br></p>'
		//códigos de emoticonos a imagenes
		html = this.editPage.wymEditor.emoToImg(html)
		// <strong> y <em> a <b> e <i>
		html = html.replace(/<(\/?)strong([ >])/ig, '<$1b$2')
		html = html.replace(/<(\/?)em([ >])/ig, '<$1i$2')

		return html
	},
	
	toRightHtml: function(html) {
		//imagenes de emoticonos a codigos
		html = this.editPage.wymEditor.imgToEmo(html)
		//<b> e <i> a <strong> y <em>
		html = html.replace(/<(\/?)b([ >])/ig, '<$1strong$2')
		html = html.replace(/<(\/?)i([ >])/ig, '<$1em$2')
		
		return html
	},
	
	/*
	 * Devuelve la celda que ocupa la posición indicada por el índice de rejilla
	 */
	getCellAtGridIndex: function(row, index) {
		var gridIndex = -1
		for (var i = 0, l = row.cells.length; i < l; i++) {
			var cell = row.cells[i]
			gridIndex += cell.colSpan
			if (gridIndex >= index) return cell
		}
		return null
	},
	
	/*
	 * Calcula el índice de rejilla de una celda
	 */
	getGridIndexOfCell: function(col) {
		var gridIndex = -1
		var row = col.parentNode
		for (var i = 0, l = col.cellIndex; i < l; i++) {
			gridIndex += row.cells[i].colSpan
		}
		return gridIndex + 1
	},
	
	dropImage: function() {
		var image = this.editPage.toolBar.imagePicker.thumbnails.isDragging()
		var document = this.iframe.contentWindow.document
		var placeHolderImg = document.getElementById(image)
		if (!placeHolderImg) {
			setTimeout(this.dropImage, 20)
			return
		}
		var img = document.createElement('img')
		img.alt = placeHolderImg.alt
		img.src = '/attachments/show/' + image + '.png'
		placeHolderImg.parentNode.replaceChild(img, placeHolderImg)
		//Event.observe(img, 'click', function() {
			//this.selection.dump()
		//}.bind(this))
		this.editPage.toolBar.imagePicker.close()
	}
})
View.Controls.WymEditor.EditPage.ToolBar = Class.create(View.Controls.WymEditor.Layoutable, {
	layout: ['strong', 'emphasized', 'erased', ' ', 'unorderedList', 'orderedList', ' ', 'header2', 'header3', ' ', 'quote', ' ', 'code', ' ', 'anchor', ' ', 'image', 'upload', ' ', 'table', ' ', 'separator', ' ', 'html', ' ', 'emoticon', ' ', 'clean'],
	layoutItems: {
		strong: {icon: 0, tip: 'Destacado'},
		emphasized: {icon: 1, tip: 'Enfatizado'},
		erased: {icon: 2, tip: 'Borrado'},

		unorderedList: {icon: 6, tip: 'Lista con viñetas'},
		orderedList: {icon: 7, tip: 'Lista numerada'},

		header2: {icon: 25, tip: 'Encabezado principal'},
		header3: {icon: 26, tip: 'Encabezado secundario'},
		
		quote: {icon: 10, tip: 'Cita'},
		
		code: {icon: 11, tip: 'Código'},
			
		anchor: {icon: 14, tip: 'Enlace'},
		
		image: {icon: 40, tip: 'Imagen'},
		upload: {icon: 13, tip: 'Subir imagen'},
		
		table: {icon: 16, tip: 'Tabla'},
		
		separator: {icon: 36, tip: 'Separador'},
		
		emoticon: {icon: 38, tip: 'Emoticono'},
		
		html: {icon: 37, tip: 'HTML de flash, video, audio, etc'},
		
		clean: {icon: 12, tip: 'Limpiar formato'}
	},
	
	initialize: function(editPage) {
		this.editPage = editPage
		this.controls = {}
	},
	
	build: function() {
		var thumbnails = controller[this.editPage.wymEditor.textArea.name + '_embeddeds'] // ¿mostramos el boton de subir imágenes?
		if (!thumbnails) this.layout.splice(this.layout.indexOf('upload'), 1)
		this.div = new Element('div', {'class': 'toolBar'})
		this.buildLayout()
		if (thumbnails) this.imagePicker = new View.Controls.WymEditor.EditPage.ToolBar.ImagePicker(this, this.controls['upload'], thumbnails)
		this.emoticonPicker = new View.Controls.WymEditor.EditPage.ToolBar.EmoticonsPicker(this, this.controls['emoticon'])
		return this.div
	},

	action: function(control) {
		var command = control.action
		switch (command) {
			case 'emoticon':
				this.emoticonPicker.toggle()
				break
			case 'upload':
				if (this.imagePicker) {
					this.imagePicker.toggle()
					break
				}
			default:
				this.editPage.editor.execCommand(command)
		}
	},
	
	update: function() {
		var editor = this.editPage.editor
		for (var control in this.controls) {
			var control = this.controls[control]
			switch (control.action) {
				case 'strong':
				case 'emphasized':
				case 'erased':
				case 'unorderedList':
				case 'orderedList':
				case 'header2':
				case 'header3':
				case 'quote':
				case 'code':
				case 'anchor':
				case 'table':
					editor.queryCommandState(control.action) ? Element.addClassName(control, 'pressed') : Element.removeClassName(control, 'pressed')
					break
				case 'indent':
				case 'outdent':
					editor.queryCommandEnabled(control.action) ? Element.enable(control) : Element.disable(control)
			}
		}
	}
})
View.Controls.WymEditor.EditPage.AttributesBar.AnchorAttributes = Class.create(View.Controls.WymEditor.Layoutable, {
	layout: ['anchorHref', ' ', 'anchorBlank'],
	layoutItems: {
		anchorHref: {type: 'text', caption: 'Destino', tip: 'URL de destino', size: 32, maxlength: 128},
		anchorBlank: {icon: 35, tip: 'Abrir en una ventana nueva'}
	},

	initialize: function(attributesBar) {
		this.attributesBar = attributesBar
		this.controls = {}
	},
	
	build: function() {
		this.div = document.createElement('div')
		this.hide()
		this.buildLayout()
		return this.div
	},
	
	show: function() {
		Element.show(this.div)
	},
	
	hide: function() {
		Element.hide(this.div)
	},
	
	update: function() {
		var editor = this.attributesBar.editPage.editor
		for (var control in this.controls) {
			var control = this.controls[control]
			switch (control.action) {
				case 'anchorHref':
					control.value = editor.queryCommandValue('anchorHref')
					var selection = this.attributesBar.editPage.editor.selection
					this.anchor = selection.inPath('a') || selection.getElements('a')[0]
					break
				case 'anchorBlank':
					editor.queryCommandState(control.action) ? Element.addClassName(control, 'pressed') : Element.removeClassName(control, 'pressed')
			}
		}
	},
	
	action: function(control) {
		var command = control.action
		switch (command) {
			default:
				this.attributesBar.editPage.editor.execCommand(command)
		}
	},
	
	focus: function(control) {
		var control = this.controls[control]
		switch (control.tagName.toLowerCase()) {
			case 'input':
				control.select()
				control.focus()
			default:
				control.focus()
		}
	},
	
	onFocusAnchorHref: function(event) {
		//this.attributesBar.editPage.editor.selection.select(this.anchor)
	},

	onKeyUpAnchorHref: function(event) {
		var event = event || window.event
		switch (event.keyCode) {
			case Event.KEY_RETURN:
				var editor = this.attributesBar.editPage.editor
				editor.selection.select(this.anchor)
				editor.focus()
				break
			default:
				this.anchor.setAttribute('href', Event.element(event).value)
		}
	},

	onKeyPressAnchorHref: function(event) {
		var event = event || window.event
		switch (event.keyCode) {
			case Event.KEY_RETURN:
				Event.stop(event)
		}
	}
})
View.Controls.WymEditor.EditPage.Editor.DTD = Class.create({
	initialize: function() {
	},
	
	blockElement: function(tag) {
		if (typeof(tag) != 'string') {
			if (!tag.tagName) return false
			tag = tag.tagName
		}
		tag = tag.toLowerCase()
		for (var i = 0, l = this.blockElements.length; i < l; i++) {
			if (this.blockElements[i] == tag) return true
		}
		return false
	},
	
	canBeChild: function(parentNode, childNode) {
		parentNode = typeof(parentNode) == 'string' ? parentNode.toLowerCase() : parentNode.tagName.toLowerCase()
		childNode = typeof(childNode) == 'string' ? childNode.toLowerCase() : (childNode.nodeType == 1 ? childNode.tagName.toLowerCase() : '#PCDATA')
		for (var i in this.elements[parentNode]['children']) {
			if (childNode == this.elements[parentNode].children[i]) return true
		}
		return false
	},
	
	isPcDataContainer: function(tag) {
		if (typeof(tag) != 'string') {
			if (!tag.tagName) return false
			tag = tag.tagName
		}
		tag = tag.toLowerCase()
		if (this.elements[tag] && this.elements[tag].content == '#PCDATA') return true
		return false
	},
		
	blockElements: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'pre', 'dl', 'div', 'noscript', 'blockquote', 'form', 'hr', 'table', 'fieldset', 'address'],

	elements: {
		'html':{
			'content':null,
			'children':['head','body']
		},
		'head':{
			'content':null,
			'children':['script','style','meta','link','object','isindex','title','script','style','meta','link','object','isindex','base','script','style','meta','link','object','isindex','base','script','style','meta','link','object','isindex','title','script','style','meta','link','object','isindex']
		},
		'title':{
			'content':'#PCDATA',
			'children':[]
		},
		'base':{
			'content':'EMPTY',
			'children':[]
		},
		'meta':{
			'content':'EMPTY',
			'children':[]
		},
		'link':{
			'content':'EMPTY',
			'children':[]
		},
		'style':{
			'content':'#PCDATA',
			'children':[]
		},
		'script':{
			'content':'#PCDATA',
			'children':[]
		},
		'noscript':{
			'content':'#PCDATA',
			'children':['#PCDATA','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		},
		'iframe':{
			'content':'#PCDATA',
			'children':['#PCDATA','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		},
		'noframes':{
			'content':'#PCDATA',
			'children':['#PCDATA','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		},
		'body':{
			'content':'#PCDATA',
			'children':['#PCDATA','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		},
		'div':{
			'content':'#PCDATA',
			'children':['#PCDATA','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		},
		'p':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'h1':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'h2':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'h3':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'h4':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'h5':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'h6':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'ul':{
			'content':null,
			'children':['li']
		},
		'ol':{
			'content':null,
			'children':['li']
		},
		'menu':{
			'content':null,
			'children':['li']
		},
		'dir':{
			'content':null,
			'children':['li']
		},
		'li':{
			'content':'#PCDATA',
			'children':['#PCDATA','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		},
		'dl':{
			'content':null,
			'children':['dt','dd']
		},
		'dt':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'dd':{
			'content':'#PCDATA',
			'children':['#PCDATA','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		},
		'address':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script','p']
		},
		'hr':{
			'content':'EMPTY',
			'children':[]
		},
		'pre':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','tt','i','b','u','s','strike','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','input','select','textarea','label','button','ins','del','script']
		},
		'blockquote':{
			'content':'#PCDATA',
			'children':['#PCDATA','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		},
		'center':{
			'content':'#PCDATA',
			'children':['#PCDATA','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		},
		'ins':{
			'content':'#PCDATA',
			'children':['#PCDATA','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		},
		'del':{
			'content':'#PCDATA',
			'children':['#PCDATA','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		},
		'a':{
			'content':'#PCDATA',
			'children':['#PCDATA','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'span':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'bdo':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'br':{
			'content':'EMPTY',
			'children':[]
		},
		'em':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'strong':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'dfn':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'code':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'samp':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'kbd':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'var':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'cite':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'abbr':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'acronym':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'q':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'sub':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'sup':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'tt':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'i':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'b':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'big':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'small':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'u':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		's':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'strike':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'basefont':{
			'content':'EMPTY',
			'children':[]
		},
		'font':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'object':{
			'content':'#PCDATA',
			'children':['#PCDATA','param','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		},
		'param':{
			'content':'EMPTY',
			'children':[]
		},
		'applet':{
			'content':'#PCDATA',
			'children':['#PCDATA','param','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		},
		'img':{
			'content':'EMPTY',
			'children':[]
		},
		'map':{
			'content':null,
			'children':['p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','noscript','ins','del','script','area']
		},
		'area':{
			'content':'EMPTY',
			'children':[]
		},
		'form':{
			'content':'#PCDATA',
			'children':['#PCDATA','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		},
		'label':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'input':{
			'content':'EMPTY',
			'children':[]
		},
		'select':{
			'content':null,
			'children':['optgroup','option']
		},
		'optgroup':{
			'content':null,
			'children':['option']
		},
		'option':{
			'content':'#PCDATA',
			'children':[]
		},
		'textarea':{
			'content':'#PCDATA',
			'children':[]
		},
		'fieldset':{
			'content':'#PCDATA',
			'children':['#PCDATA','legend','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		},
		'legend':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'button':{
			'content':'#PCDATA',
			'children':['#PCDATA','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','table','br','span','bdo','object','applet','img','map','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','noscript','ins','del','script']
		},
		'isindex':{
			'content':'EMPTY',
			'children':[]
		},
		'table':{
			'content':null,
			'children':['caption','col','colgroup','thead','tfoot','tbody','tr']
		},
		'caption':{
			'content':'#PCDATA',
			'children':['#PCDATA','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','ins','del','script']
		},
		'thead':{
			'content':null,
			'children':['tr']
		},
		'tfoot':{
			'content':null,
			'children':['tr']
		},
		'tbody':{
			'content':null,
			'children':['tr']
		},
		'colgroup':{
			'content':null,
			'children':['col']
		},
		'col':{
			'content':'EMPTY',
			'children':[]
		},
		'tr':{
			'content':null,
			'children':['th','td']
		},
		'th':{
			'content':'#PCDATA',
			'children':['#PCDATA','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		},
		'td':{
			'content':'#PCDATA',
			'children':['#PCDATA','p','h1','h2','h3','h4','h5','h6','div','ul','ol','dl','menu','dir','pre','hr','blockquote','address','center','noframes','isindex','fieldset','table','form','a','br','span','bdo','object','applet','img','map','iframe','tt','i','b','u','s','strike','big','small','font','basefont','em','strong','dfn','code','q','samp','kbd','var','cite','abbr','acronym','sub','sup','input','select','textarea','label','button','noscript','ins','del','script']
		}
	}
})
View.Controls.WymEditor.EditPage.ToolBar.EmoticonsPicker = Class.create(View.Controls.Pickable, {
	// http://messenger.yahoo.com/features/emoticons
	emoticons: {
		':)': ['Contento', 1],
		':(': ['Disgustado', 2],
		';)': ['Guiño', 3],
		':D': ['Sonriendo', 4],
		':-/': ['Dubitativo', 7],
		':P': ['Bonachon', 10],
		':-O': ['Sorprendido', 13],
		'X(': ['Enojado', 14],
		'B-)': ['Vacilando', 16],
		':|': ['Indiferente', 22]
	},
	
	/*
	:) feliz 1
	:( triste 2
	;) guiño 3
	:D sonriendo 4
	;;) coqueteando
	>:D< abrazo
	:-/ confundido
	:x enamorado
	:"> ruborizado
	:P lengua
	:-* beso
	=(( corazón roto
	:-O sorprendido
	X( enfadado
	
	
	1: 'feliz'
	'triste'
	'guiño'
	'gran sonrisa'
	'coqueteo'
	'abrazos'
	'confundido'
	'amor'
	'rubor'
	'lengua'
	'beso'
	'corazon roto'
	'sorpresa'
	enfadado
	smug
	vacilon
	preocupado
	apurado
	diablo
	llorando
	risa
	indiferente
	dubitativo
	muerto de risa
	angel
	friki
	choca
	me llaman
	en el teléfono
	tirarse de los pelos
	hola
	fuera de tiempo
	soñando
	durmiendo
	mirando alrededor
	perdedor
	enfermooooooooo
	secreto
	no me hablo
	payaso
	tonto
	fiesta
	aburrido
	babeando
	pensasivo
	problemas
	aplausos
	nervioso
	hipnotizado
	mentiroso
	esperando
	suspiro
	protesta
	corboy
	no quiero verlo
	date prisa
	rock on
	no mola
	mola
	no se me
	piratas*/
	
	
	
	
	
	initialize: function(toolBar, openerButton) {
		this.toolBar = toolBar
		this.openerButton = openerButton
		
		this.emoticonsReady = {}
		for (var emo in this.emoticons) {
			this.emoticonsReady[this.emoticons[emo][1]] = emo 
		}

		this.onResize = this.onResize.bind(this)
		this.onClick = this.onClick.bind(this)
		this.onClickEmoticon = this.onClickEmoticon.bind(this)
		
		this.build()
	},
	
	build: function() {
		this.div = document.createElement('div')
		this.div.className = 'emoticon picker'
		Element.hide(this.div)
		
		var onClickEmoticon
		for (var e in this.emoticons) {
			var emoticon = this.emoticons[e]
			var img = document.createElement('img')
			img.src = '/images/emo/' + emoticon[1] + '.gif'
			img.alt = img.title = emoticon[0]
			img.onclick = this.onClickEmoticon
			this.div.appendChild(img)
		}
		//this.openerButton.parentNode.appendChild(this.div)
		document.body.appendChild(this.div)
	},
	
	onClickEmoticon: function(event) {
		var img = Event.element(event || window.event)
		this.toolBar.editPage.editor.execCommand('emoticon', img.getAttribute('src').match(/(\d+)\.gif/)[1])
		this.close()
	},
	
	open: function() {
		View.Controls.Pickable.open.call(this)
		var window = this.toolBar.editPage.editor.iframe.contentWindow
		Event.observe(Prototype.Browser.IE ? window.document.body : window, 'click', this.onClick)
	},
	
	close: function() {
		View.Controls.Pickable.close.call(this)
		Event.stopObserving(window, 'resize', this.onClick)
	}
})

View.Controls.WymEditor.EditPage.AttributesBar.ImageAttributes = Class.create(View.Controls.WymEditor.Layoutable, {
	layout: ['imageLeft', 'imageCenter', 'imageRight', ' ', 'imageBorder', ' ', 'imageZoom'],
	layoutItems: {
		imageLeft: {icon: 30, tip: 'Alinea la imagen a la izquierda'},
		imageCenter: {icon: 31, tip: 'Centra la imagen'},
		imageRight: {icon: 32, tip: 'Alinea la imagen a la derecha'},
		imageBorder: {icon: 33, tip: 'Añade un borde a la imagen'},
		imageZoom: {icon: 34, tip: 'Permite al lector aumentar la imagen'}
		//imageName: {type: 'text', caption: 'Nombre', tip: 'Nombre', size: 16, maxlength: 64}
	},
	
	initialize: function(attributesBar) {
		this.attributesBar = attributesBar
		this.controls = {}
	},
	
	build: function() {
		this.div = document.createElement('div')
		this.hide()
		this.buildLayout()
		return this.div
	},
	
	show: function() {
		Element.show(this.div)
	},
	
	hide: function() {
		Element.hide(this.div)
	},
	
	update: function() {
		var editor = this.attributesBar.editPage.editor
		for (var control in this.controls) {
			var control = this.controls[control]
			switch (control.action) {
				/*
				case 'imageName':
					control.value = editor.queryCommandValue('imageName')
					break*/
				case 'imageLeft':
				case 'imageCenter':
				case 'imageRight':
				case 'imageBorder':
				case 'imageZoom':
					editor.queryCommandState(control.action) ? Element.addClassName(control, 'pressed') : Element.removeClassName(control, 'pressed')
			}
		}
	},
	
	action: function(control) {
		var command = control.action
		switch (command) {
			default:
				this.attributesBar.editPage.editor.execCommand(command)
		}
	}
	/*
	onKeyPressImageName: function(event) {
		var input = Event.element(event || window.event)
		switch (event.keyCode) {
			case Event.KEY_RETURN:
				input.blur()
				this.attributesBar.editPage.editor.focus()
				Event.stop(event)
		}
		this.attributesBar.editPage.editor.execCommand('imageName', input.value)
	}*/
})
View.Controls.WymEditor.EditPage.ToolBar.ImagePicker = Class.create(View.Controls.Pickable, {
	initialize: function(toolBar, openerButton, thumbnails) {
		this.toolBar = toolBar
		this.openerButton = openerButton
		this.thumbnails = thumbnails
		
		this.onResize = this.onResize.bind(this)
		this.onClick = this.onClick.bind(this)
		this.build()
	},
	
	build: function() {
		this.div = document.createElement('div')
		this.div.className = 'image picker'
		Element.hide(this.div)
		
		//this.thumbnails.iframe.parentNode.removeChild(this.thumbnails.iframe)
		//this.div.appendChild(this.thumbnails.iframe)
		this.thumbnails.thumbsDiv.parentNode.removeChild(this.thumbnails.thumbsDiv)
		this.div.appendChild(this.thumbnails.thumbsDiv)
		var buttonsDiv = this.thumbnails.addButton.parentNode
		buttonsDiv.parentNode.removeChild(buttonsDiv)
		this.div.appendChild(buttonsDiv)
		
		//this.openerButton.parentNode.appendChild(this.div)
		document.body.appendChild(this.div)
		//this.div.style.width = this.div.scrollWidth + 'px'
	},
	
	open: function() {
		View.Controls.Pickable.open.call(this)
		var window = this.toolBar.editPage.editor.iframe.contentWindow
		Event.observe(Prototype.Browser.IE ? window.document.body : window, 'click', this.onClick)
	},
	
	close: function() {
		View.Controls.Pickable.close.call(this)
		this.thumbnails.dragStop()
		Event.stopObserving(window, 'resize', this.onClick)
	}
})
View.Controls.WymEditor.EditPage.AttributesBar.ListAttributes = Class.create(View.Controls.WymEditor.Layoutable, {
	layout: ['outdent', 'indent'],
	layoutItems: {
		outdent: {icon: 9, tip: 'Reducir anidado'},
		indent: {icon: 8, tip: 'Aumentar anidado'}
	},

	initialize: function(attributesBar) {
		this.attributesBar = attributesBar
		this.controls = {}
	},
	
	build: function() {
		this.div = document.createElement('div')
		this.hide()
		
		this.buildLayout()
		
		return this.div
	},
	
	show: function() {
		Element.show(this.div)
	},
	
	hide: function() {
		Element.hide(this.div)
	},
	
	update: function() {
		var editor = this.attributesBar.editPage.editor
		for (var control in this.controls) {
			var control = this.controls[control]
			switch (control.action) {
				case 'outdent':
				case 'indent':
					editor.queryCommandEnabled(control.action) ? Element.enable(control) : Element.disable(control)
			}
		}
	},
	
	action: function(control) {
		var command = control.action
		switch (command) {
			default:
				this.attributesBar.editPage.editor.execCommand(command)
		}
	}
})
View.Controls.WymEditor.EditPage.Editor.Selection = Class.create({
	initialize: function(editor) {
		this.editor = editor
	},
	
	/*
	 * Devuelve el objeto selection nativo del navegador
	 */
	selection: function() {
		var win = this.editor.iframe.contentWindow
		return win.getSelection ? win.getSelection() : win.document.selection
	},
	
	/*
	 * Devuelve el rango de la selección actual
	 */
	range: function() {
		var selection = this.selection()
		return selection.getRangeAt ? selection.getRangeAt(0) : selection.createRange()
	},
	
	/*
	 * Devuelve el primer elemento ascendiente que contiene a toda la seleccion
	 */
	parent: function(textNodes) {
		var range = this.range()
		var parent = range.commonAncestorContainer
		if (parent) {
			if (!textNodes && parent.nodeType == 3) parent = parent.parentNode //si es un nodo de texto consideramos padre a su padre
		} else {
			parent = range.item ? range.item().parentNode : range.parentElement()
		}
		return parent
	},
	
	/* 
	 * Indica si la selección está colapsada
	 */
	collapsed: function() {
		var selection = this.selection()
		var collapsed = selection.isCollapsed
		if (collapsed === undefined) collapsed = selection.type == 'None'
		return collapsed
	},
	
	/* 
	 * Averigua si un nodo esta seleccionado completa o parcialmente
	 */
	selected: function(node, entire) {
		var selection = this.selection()
		if (selection.containsNode) {
			return selection.containsNode(node, !entire)
		} else { // ie
			var range = selection.createRange()
			if (range.item) { //control
				return range.item() == node
			} else { // text
				var elmRange = this.editor.iframe.contentWindow.document.body.createTextRange()
				elmRange.moveToElementText(node)
				return range.inRange(elmRange)
			}
		}
	},
	
	/* 
	 * Indica el tipo de selección
	 */
	type: function() {
		
	},
	
	/* 
	 * Indica si un elemento con determinado tag es un ascendiente de la selección
	 */
	inPath: function(tag) {
		var tag = tag.toLowerCase()
		var parent = this.parent()
		while (parent.tagName) {
			var parentTag = parent.tagName.toLowerCase()
			for (var i = 0, l = arguments.length; i < l; i++) {
				if (parentTag == arguments[i]) return parent
			}
			parent = parent.parentNode			
		}
		return false
	},
	
	/* 
	 * Indica si la seleccion tiene un elemento padre que sea de bloque
	 */
	inBlock: function() {
		var parent = this.parent()
		while (parent.tagName) {
			if (this.editor.dtd.blockElement(parent.tagName)) return parent
			parent = parent.parentNode
		}
		return false
	},
	
	/* 
	 * Selecciona el texto de un nodo
	 */
	select: function(node) {
		if (Prototype.Browser.IE) {
			var range = this.editor.iframe.contentWindow.document.body.createTextRange()
			switch (node.nodeType) {
				case 1: // Element
					range.moveToElementText(node)
					range.select()
					break
				case 3: // TextNode
					range.moveToElementText(node.parentNode)
					var elmRange = range.duplicate()
					for (var i = 0, l = node.parentNode.childNodes.length; i < l; i++) {
						var child = parent.childNodes[i]
						switch (child.nodeType) {
							case 1: // Element
								elmRange.moveToElementText(child)
								break
							case 3: // TextNode
								elmRange.setEndPoint('StartToStart', range)
								elmRange.setEndPoint('EndToEnd', range)
								elmRange.findText(child.data, 0, 131072) // busca dentro del rango en modo binario
								if (child == node) {
									elmRange.select()
									return
								}
						}
						range.setEndPoint('StartToEnd', elmRange)
					}
			}
		} else {
			var range = this.range()
			range.selectNodeContents(node)
			this.normalize()
		}
	},
	
	/* 
	 * Expande la seleccion para que abarque por completo todos los nodos que están parcialmente seleccionados
	 */
	expand: function() {
		var selection = this.selection()
		if (Prototype.Browser.IE) {
			var range = selection.createRange()
			switch (selection.type) {
				case 'Text':
					var endRange = range.duplicate()
					range.collapse(true)
					var begin = this.findSelectedTextNode(range)
					if (begin) {
						range.setEndPoint('StartToStart', begin.range)
						endRange.collapse(false)
						var end = this.findSelectedTextNode(endRange)
						if (end) range.setEndPoint('EndToEnd', end.range)
						range.select()
					}
					break
					
				case 'None':
					var end = this.findSelectedTextNode(range)
					if (end) {
						range.setEndPoint('StartToStart', end.range)
						range.setEndPoint('EndToEnd', end.range)
						range.select()
					}
			}		
		} else {
			var selection = this.selection()
			var range = selection.getRangeAt(0)
			var begin = range.startContainer
			var end = range.endContainer
			range.setStart(begin, 0)
			range.setEnd(end, end.nodeType == 3 ? end.nodeValue.length : end.childNodes.length)
		}
	},
	
	/* 
	 * Expande la seleccion para que abarque el primer elemento ascendiente de bloque
	 */
	expandToBlock: function() {
		var block = this.inBlock()
		if (block) {
			this.select(block)
			return block
		}
		return false
	},
	
	/* 
	 * Normaliza la selección haciendo que los nodos de inicio y final siempre sean de texto
	 */
	normalize: function() {
		if (Prototype.Browser.IE) return
		var selection = this.selection()
		// si no hay selección la collapsamos dentro del primer elemento
		if (!selection.rangeCount) { // no hay seleccion
			var body = this.editor.iframe.contentWindow.document.body
			var elm = this.findFirstPcDataContainer(body, true) || body
			selection.collapse(elm, 0)
			return
		}
		if (
			selection.isCollapsed ||
			(
				selection.anchorNode == selection.focusNode && (
					selection.anchorNode.nodeType == 3 || //dentro de un único nodo de texto
					(selection.focusOffset - selection.anchorOffset == 1 && selection.getRangeAt(0).cloneContents().childNodes[0].tagName == 'IMG') // imagen
				)
			) ||
			(selection.anchorNode.nodeType == 3 && selection.focusNode.nodeType == 3 && selection.anchorOffset != selection.anchorNode.nodeValue.length && selection.focusOffset != 0) //ya empieza e inicia en nodos de texto
		) return
		var range = selection.getRangeAt(0)
		var end = this.doNormalization(selection, range, range.commonAncestorContainer)
		if (end) {
			if (end != range.endContainer) range.setEnd(end, end.nodeValue.length)
		} else {
			var elm = this.findFirstPcDataContainer(range.commonAncestorContainer)
			selection.collapse(elm, 0)
		}
	},

	doNormalization: function(selection, range, parent, last) {
		for (var i = 0, l = parent.childNodes.length; i < l; i++) {
			var child = parent.childNodes[i]
			if (last) {
				if (!selection.containsNode(child, true)) return last
				last = child.nodeType == 3 ? child : this.doNormalization(selection, range, child, last);
			} else {
				if (!selection.containsNode(child, true)) continue
				if (child.nodeType == 3) {
					if (child != range.startContainer) range.setStart(child, 0)
					last = child
				} else {
					last = this.doNormalization(selection, range, child, last)
				}
			}
		}
		return last
	},
	
	
	/* 
	 * Devuelve información sobre los nodos donde empieza y acaba la selección actual
	 */
	boundaries: function() {
		var selection = this.selection()
		if (Prototype.Browser.IE) {
			var range = selection.createRange()
			var boundaries = {parent: range.parentElement(), begin: {}, end: {}}
			switch (selection.type) {
				case 'Text':
					var endRange = range.duplicate()
					range.collapse(true)
					var textNode = this.findSelectedTextNode(range)
					boundaries.begin.node = textNode ? textNode.node : range.parentElement()
					endRange.collapse(false)
					textNode = this.findSelectedTextNode(endRange)
					boundaries.end.node = textNode ? textNode.node : endRange.parentElement()
					break
				case 'None':
					var textNode = this.findSelectedTextNode(range)
					boundaries.begin.node = textNode ? textNode.node : range.parentElement()
					boundaries.end.node = boundaries.begin.node
			}
			return boundaries
		} else {
			var range = selection.getRangeAt(0)
			var parent = range.commonAncestorContainer
			if (parent.nodeType == 3) parent = parent.parentNode //si es un nodo de texto consideramos padre a su padre
			return {
				parent: parent,
				begin: {node: range.startContainer, offset: range.startOffset}, // {node: pointer to start node, offset: offset of selection start to node start}
				end: {node: range.endContainer, offset: range.endOffset} // {node: pointer to end node, offset: offset of selection end to node start}
			}
		}
	},
	
	/* 
	 * Busca el primer o último nodo de texto dentro de un elemento
	 */
	findTextNode: function(node, last) {
		if (node.nodeType == 3) {
			return node
		} else if (node.hasChildNodes()) {
			if (last) {
				for (var i = node.childNodes.length - 1; i >= 0; i--) {
					var result = this.findTextNode(node.childNodes[i], last)
					if (result)	return result
				}
			} else {
				for (var i = 0, l = node.childNodes.length; i < l; i++) {
					var result = this.findTextNode(node.childNodes[i])
					if (result) return result
				}
			}
			return null
		}
	},
	
	inRange: function(range, elmRange) {
		// ||||++-------- ++++++---- --++++++-- ----++++++ --------++|||| 
		var e2s = range.compareEndPoints('EndToStart', elmRange)
		var e2e = range.compareEndPoints('StartToEnd', elmRange)
		return
			!(e2s == -1 || s2e == 1) && // |||||| ---------- ---------- ||||||
			!(e2s == 0 && range.compareEndPoints('StartToStart', elmRange)==-1) &&// ||||||----------
			!(s2e == 0 && range.compareEndPoints('EndToEnd', elmRange)==1) // ----------||||||
	},
	
	findSelectedTextNode: function(range) {
		var parent = range.parentElement()
		var parentRange = range.duplicate()
		parentRange.moveToElementText(parent)
		var elmRange = parentRange.duplicate()
		for (var i = 0, l = parent.childNodes.length; i < l; i++) {
			var child = parent.childNodes[i]
			switch (child.nodeType) {
				case 1: // Element
					elmRange.moveToElementText(child)
					parentRange.setEndPoint('StartToEnd', elmRange)
					break
				case 3: // TextNode
					elmRange.setEndPoint('StartToStart', parentRange)
					elmRange.setEndPoint('EndToEnd', parentRange)
					elmRange.findText(child.data, 0, 131072) // busca dentro del rango en modo binario
					if (elmRange.inRange(range)) return {node: child, range: elmRange}
					parentRange.setEndPoint('StartToEnd', elmRange)
			}
		}
	},
	
	/*
	 * Busca los elementos con el tag especificado entre los que estan seleccionados
	 */
	getElements: function(tag) {
		var selecteds = []
		var elements = this.parent().getElementsByTagName(tag)
		for (var i = 0, l = elements.length; i < l; i++) {
			var element = elements[i]
			if (this.selected(element)) selecteds.push(element)
		}
		return selecteds
	},
	
	/*
	 * Memoriza la selección actual
	 */
	memo: function() {
		return
		if (Prototype.Browser.IE) {
			var range = this.range()
			if (range.getBookmark) this.memoRange = range.getBookmark()
		}
	},
	
	/*
	 * Restaura la selección memorizada
	 */
	restore: function() {
		return
		if (Prototype.Browser.IE && this.memoRange) {
			var range = this.range()
			range.moveToBookmark(this.memoRange)
			range.select()
			delete this.memoRange
		}
	},
	
	insert: function(content) {
		this.editor.iframe.contentWindow.focus()
		var range = this.range()
		var string = typeof content == 'string'
		if (range.pasteHTML) { // IE teniendo seleccionado texto
			range.pasteHTML(string ? content : content.outerHTML)
		} else if (range.item) { // IE teniendo seleccionado un control
			var item = range.item(), parent = item.parentNode
			if (string) {
				var div = this.editor.iframe.contentWindow.document.createElement('div')
				div.innerHTML = content
				var child
				while (child = div.firstChild) {
					div.removeChild(child)
					parent.insertBefore(child, item)
				}
				parent.removeChild(item)
			} else {
				parent.replaceChild(content, item)
			}
		} else { // otros
			if (string) {
				this.editor.iframe.contentWindow.document.execCommand('insertHTML', false, content)
			} else {
				range.deleteContents()
				range.insertNode(content)
				range.setEndAfter(content)
				range.collapse(false)
			}
		}
	},
	
	findFirstPcDataContainer: function(parent, excludeParent) {
		if (!excludeParent && this.editor.dtd.isPcDataContainer(parent)) return parent
		for (var i = 0, l = parent.childNodes.length; i < l; i++) {
			var result = this.findFirstPcDataContainer(parent.childNodes[i])
			if (result) return result
		}
		return null
	},
	
	dump: function(boundaries) {
		if (!boundaries) boundaries = this.boundaries()
		alert(
			"Parent:\n\n" +
			"\tnode: " + boundaries.parent + "\n\n" +
			"Begin:\n\n" +
			"\tnode: " + boundaries.begin.node + "\n" +
			"\tvalue: " + (boundaries.begin.node.nodeValue || boundaries.begin.node.data) + "\n" +
			"\toffset: " + boundaries.begin.offset + "\n\n" +
			"End:\n\n" +
			"\tnode: " + boundaries.end.node + "\n" +
			"\tvalue: " + boundaries.end.node.nodeValue + "\n" +
			"\toffset: " + boundaries.end.offset
		)
	}
})
View.Controls.WymEditor.EditPage.AttributesBar.TableAttributes = Class.create(View.Controls.WymEditor.Layoutable, {
	layout: ['tableAddTRow', 'tableAddBRow', 'tableAddLCol', 'tableAddRCol', ' ', 'tableDelRow', 'tableDelCol', ' ', 'tableHeader'],
	layoutItems: {
		tableAddBRow: {icon: 17, tip: 'Añadir fila debajo'},
		tableAddTRow: {icon: 18, tip: 'Añadir fila encima'},
		tableAddLCol: {icon: 20, tip: 'Añadir columna a la izquierda'},
		tableAddRCol: {icon: 19, tip: 'Añadir columna a la derecha'},
		tableDelRow: {icon: 21, tip: 'Eliminar fila'},
		tableDelCol: {icon: 22, tip: 'Eliminar columna'},
		tableHeader: {icon: 39, tip: 'Encabezado'}
	},
	
	initialize: function(attributesBar) {
		this.attributesBar = attributesBar
		this.controls = {}
	},
	
	build: function() {
		this.div = document.createElement('div')
		this.hide()
		this.buildLayout()
		return this.div
	},
	
	show: function() {
		Element.show(this.div)
	},
	
	hide: function() {
		Element.hide(this.div)
	},
	
	update: function() {
		var editor = this.attributesBar.editPage.editor
		for (var control in this.controls) {
			var control = this.controls[control]
			switch (control.action) {
				case 'tableDelRow':
				case 'tableDelCol':
					editor.queryCommandEnabled(control.action) ? Element.enable(control) : Element.disable(control)
					break
				case 'tableHeader':
					editor.queryCommandEnabled(control.action) ? Element.enable(control) : Element.disable(control)
					editor.queryCommandState(control.action) ? Element.addClassName(control, 'pressed') : Element.removeClassName(control, 'pressed')
			}
		}
	},
	
	action: function(control) {
		var command = control.action
		switch (command) {
			default:
				this.attributesBar.editPage.editor.execCommand(command)
		}
	}
})
View.Controls.Attachments.Thumbnails = Class.create(View.Controls.Attachments, {
	select: null,
	options: null,
	thumbsDiv: null,
	focused: null,
	anchor: null,
	dragging: false,
	
	initialize: function(model, attachment, options) {
		View.Controls.Attachments.prototype.initialize.call(this, model, attachment, options)
		this.thumbsDiv = new Element('div', {'class': 'thumbnails'})
		this.thumbsDiv.style.width = this.select.offsetWidth + 'px'
		if (!this.disabled) {
			this.onFocus = this.onFocus.bind(this)
			this.onBlur = this.onBlur.bind(this)
			//this.onKeyPress = this.onKeyPress.bind(this)
			Event.observe(this.thumbsDiv, 'click', this.onFocus)
		}
		Element.insertAfter(this.thumbsDiv, this.select)
		this.select.style.display = 'none'
		this.delButton.parentNode.style.width = this.thumbsDiv.offsetWidth + 'px'
		
		this.synchronizeThumbnails()
	},

	onFocus: function() {
		this.thumbsDiv.style.backgroundColor = view.colors.get('focused')
		Event.stopObserving(this.thumbsDiv, 'click', this.onFocus)
		//Event.observe(document, 'keypress', this.onKeyPress)
		Event.observe(Prototype.Browser.IE ? document.body : window, 'click', this.onBlur)
	},
	
	onBlur: function(event) {
		var target = Event.element(event || window.event)
		while (target.nodeType == 1) {
			if (target == this.thumbsDiv) {
				return
			}
			target = target.parentNode
		}
		this.thumbsDiv.style.backgroundColor = 'transparent'
		Event.observe(this.thumbsDiv, 'click', this.onFocus)
		//Event.stopObserving(document, 'keypress', this.onKeyPress)
		Event.stopObserving(Prototype.Browser.IE ? document.body : window, 'click', this.onBlur)
	},
	
	onClickThumbnail: function(event) {
		var img = Event.element(event || window.event)
		var imgs = this.thumbsDiv.getElementsByTagName('img')
		this.focused = img
		if (event.ctrlKey) {
			if (img.selected) {
				img.selected = false
				this.anchor = null
			} else {
				img.selected = true
				this.anchor = img
			}
		} else if (event.shiftKey) {
			if (this.anchor) {
				var closeWith = false
				for (var i = 0; i < imgs.length; i++) {
					if (!closeWith && (imgs[i] == this.anchor || imgs[i] == img)) {
						closeWith = imgs[i] == this.anchor ? img : this.anchor
					}
					if (closeWith) {
						imgs[i].selected = true
						if (imgs[i] == closeWith) closeWith = false
					} else {
						imgs[i].selected = false
					}
				}
			} else {
				img.selected = true
				this.anchor = img
			}
		} else {
			for (var i = 0; i < imgs.length; i++) {
				imgs[i].selected = false
			}
			img.selected = true
			this.anchor = img
		}
		for (var i = 0; i < imgs.length; i++) {
			imgs[i].style.borderColor = imgs[i].selected ? view.colors.get('selected') : 'transparent'
		}
		this.synchronizeSelect()
	},
	
	onClickUpButton: function() {
		this.moveSelectedOptionsUp()
		this.synchronizeThumbnails()
	},
	
	onClickDownButton: function() {
		this.moveSelectedOptionsDown()
		this.synchronizeThumbnails()
	},
	
	onClickDelButton: function() {
		if (confirm('¿Estás seguro?')) {
			this.removeSelectedOptions()
			this.synchronizeThumbnails()
		}
	},
	
	addOptions: function(pairs) {
		View.Controls.Attachments.prototype.addOptions.call(this, pairs)
		this.synchronizeThumbnails()
	},
	
	onKeyPress: function(event) {
		switch (event.keyCode) {
			case Event.KEY_LEFT:
				if (this.focused.previousSibling) {
					this.focused.previousSibling.selected = true
					this.focused.selected = false
					this.focused = this.focused.previousSibling
				}
				break
			case Event.KEY_RIGHT:
				if (this.focused.nextSibling) {
					this.focused.nextSibling.selected = true
					this.focused.selected = false
					this.focused = this.focused.nextSibling
				}
				break
			case Event.KEY_BACKSPACE:
			case Event.KEY_DELETE:
				this.onClickDelButton()
				break
			default:
				return
		}
		this.synchronizeSelect()
	},
	
	synchronizeThumbnails: function() {
		//remove thumbs of deleted files
		var imgs = this.thumbsDiv.childNodes
		for (var i = 0; i < imgs.length; ) {
			var found = false
			for (var j = 0; j < this.select.options.length; j++) {
				if (this.select.options[j].value == imgs[i].id) {
					found = true
					break
				}
			}
			if (!found) {
				this.thumbsDiv.removeChild(imgs[i])
			} else {
				i++
			}
		}
		//move or add thumbs
		for (var i = 0; i < this.select.options.length; i++) {
			var found = -1
			for (var j = 0; j < imgs.length; j++) {
				if (imgs[j].id == this.select.options[i].value) {
					found = j
					break
				}
			}
			var img = false
			if (found > -1) {
				if (j != i) {
					img = imgs[j].cloneNode(true)
					this.thumbsDiv.removeChild(imgs[j])
				}
			} else {
				img = document.createElement('img')
				Element.setStyle(img, {
					height: '58px',
					border: '3px solid transparent',
					marginRight: '4px'
				})
				img.alt = this.select.options[i].text
				img.id = this.select.options[i].value
				img.src = '/attachments/show/' + this.select.options[i].value + '.png'
			}
			if (img) {
				imgs[i] ? this.thumbsDiv.insertBefore(img, imgs[i]) : this.thumbsDiv.appendChild(img)
				if (!this.disabled) {
					Event.observe(img, 'click', this.onClickThumbnail.bind(this))
					//Event.observe(img, 'dblclick', onDblClickThumbnail.bind(img))
					Event.observe(img, Prototype.Browser.IE ? 'dragstart' : 'draggesture', this.onDragStart.bind(this))
				}
			}
		}
		for (var i = 0; i < this.select.options.length; i++) {
			imgs[i].selected = this.select.options[i].selected
		}
		for (var i = 0; i < imgs.length; i++) {
			imgs[i].style.borderColor = imgs[i].selected ? view.colors.get('selected') : 'transparent'
		}
	},
	
	synchronizeSelect: function() {
		var imgs = this.thumbsDiv.childNodes
		for (var i = 0; i < imgs.length; i++) {
			this.select.options[i].selected = imgs[i].selected
		}
		this.updateButtons()
	},
	
	onDragStart: function(event) {
		var img = Event.element(event || window.event)
		this.dragging = img
	},
	
	dragStop: function() {
		this.dragging = false
	},
	
	isDragging: function() {
		return this.dragging && this.dragging.id
	},
	
	getDraggingItems: function() {
		if (!this.dragging) return false
		var draggingItems = []
		var imgs = this.thumbsDiv.childNodes
		for (var i = 0, l = this.select.options.length; i < l; i++) {
			var option = this.select.options[i]
			if (option.selected) draggingItems.push(option.value)
		}
		return draggingItems
	}
})
view.highlighter = new function() {
	this.elm = null,
	this.stepAt = 1,
	this.timer = null,
	
	this.start = function() {
		this.stop()
		this.elm = $A(arguments)
		this.step()
	},
	
	this.step = function() {
		if (this.stepAt % 2) {
			for (var i = 0, l = this.elm.length; i < l; i++) Element.addClassName(this.elm[i], 'highlighted')
		} else {
			for (var i = 0, l = this.elm.length; i < l; i++) Element.removeClassName(this.elm[i], 'highlighted')
		}
		this.stepAt++
		if (this.stepAt < 8) {
			this.timer = setTimeout(arguments.callee.bind(this), 250)
		} else {
			this.stop()
		}	
	},
	
	this.stop = function() {
		if (this.elm) {
			clearTimeout(this.timer)
			for (var i = 0, l = this.elm.length; i < l; i++) Element.removeClassName(this.elm[i], 'highlighted')
			this.elm = null
		}
		this.stepAt = 1
	}
}

View.WaitLayer = Class.create({
    initialize: function() {
        this.onWindowResize = this.onWindowResize.bind(this)
    },
	
	show: function(message) {
        this.overflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
		if (!this.div) {
			this.div = document.createElement('div')
            this.div.className = 'waitLayer'
			Element.setOpacity(this.div, 0)
			document.body.appendChild(this.div)
            this.innerDiv = document.createElement('div')
			this.innerDiv.className = 'waitLayerMsg'
            Element.setOpacity(this.innerDiv, 0)
			document.body.appendChild(this.innerDiv)
		} else {
			Element.setOpacity(this.div, 0)
			Element.show(this.div)
			Element.setOpacity(this.innerDiv, 0)
			Element.show(this.innerDiv)
            this.innerDiv.innerHTML = ''
        }
		if (message) {
			this.innerDiv.innerHTML = message.escapeHTML().replace(/\n/g, '<br />')
		}
        this.place()
		Effect.Appear(this.div, {duration: 0.25, to: 0.5})
		Effect.Appear(this.innerDiv, {duration: 0.25, to: 1})
        Event.observe(window, 'resize', this.onWindowResize)
	},
	
	hide: function() {
        Event.stopObserving(window, 'resize', this.onWindowResize)
		Effect.Fade(this.innerDiv, {duration: 0.25})
		Effect.Fade(this.div, {duration: 0.25})
        document.body.style.overflow = this.overflow
		//fix para chrome, que no restaura las barras de scroll
		if (window.scrollY) {
			var y = scrollY
			scrollTo(scrollX, y + 1)
			scrollTo(scrollX, y)
		}
	},
     
    place: function() {
		var viewport = document.viewport.getDimensions()
        Element.setStyle(this.div, {
			width: (viewport.width) + 'px',
			height: (viewport.height) + 'px'
        })
		var scroll = document.viewport.getScrollOffsets()
        Element.setStyle(this.innerDiv, {
            left: (scroll.left + Math.round((viewport.width - this.innerDiv.offsetWidth) / 2)) + 'px',
            top: (scroll.top + Math.round((viewport.height - this.innerDiv.offsetHeight) / 2)) + 'px'
        })
    },
    
    onWindowResize: function() {
        this.place()
    }
})
view.waitLayer = new View.WaitLayer
view.browser = new function() {
	this.explorer = document.all ? true : false
	this.quirksMode = document.compatMode && document.compatMode != 'BackCompat' ? false : true
	/*
	this.mozilla = null
	
	var rv = navigator.userAgent.match(/rv:\s*([\.0-9]+)/)
	if (rv) {
		rvParts = rv[1].split('.')
		rv = 0
		var exp = 1
		for (var i = 0; i < rvParts.length; i++) {
			rv += parseInt(rvParts[i]) / exp
			exp *= 100
		}
		this.mozilla = {rv: rv}
	}
	
	this.fix = function() {
		if (this.explorer) {
			fixIE()
		} else if (this.mozilla) {
			//fixMozilla()
		}
	}
	
	var fixIE = function() {
		var rules = document.styleSheets[0].rules
		var length = rules.length
		for (var i = 0; i < length; i++) {
			//border-spacing CSS property
			var matches = rules[i].style.cssText.match(/border-spacing\s*?:\s*?(\d+)px/)
			if (matches) {
				var subjects = $$(rules[i].selectorText)
				for (var j = 0; j < subjects.length; j++) {
					subjects[j].cellSpacing = matches[1]
				}
			}
			//:hover CSS pseudo class also in other elements than A
			if (rules[i].selectorText.search(':hover') > -1) {
				var subjects = $$(rules[i].selectorText)
				var defineClass = false
				for (var j = 0; j < subjects.length; j++) {
					if (subjects[j].tagName != 'A') {
						defineClass = true
						subjects[j].attachEvent('onmouseover', (new Function("Element.addClassName(this, 'klass" + i + "')").bind(subjects[j])))
						subjects[j].attachEvent('onmouseout', (new Function("Element.removeClassName(this, 'klass" + i + "')")).bind(subjects[j]))
					}
				}
				if (defineClass) {
					document.styleSheets[0].addRule('.klass' + i, rules[i].style.cssText.replace(/;/g, ' !important;') + ' !important')
				}
			}
		}
		//:hover in A elements displayed as block
		var anchors = document.getElementsByTagName('A')
		for (var i = 0; i < anchors.length; i++) {
			if (anchors[i].style.display == 'block') {
				anchors[i].appendChild(document.createElement('IMG'))
			}
		}
		//associate labels with their enclosed field
		var tags = ['INPUT', 'SELECT', 'TEXTAREA']
		var labels = document.getElementsByTagName('LABEL')
		for (var i = 0; i < labels.length; i++) {
			var j = 0
			do {
				var field = labels[i].getElementsByTagName(tags[j])
				if (field) {
					field = field[0]
				}
				j++
			} while (!field && j < tags.length)
			if (field) {
				if (!field.id) {
					field.id = 'field' + Math.round(Math.random()*999999)
				}
				labels[i].htmlFor = field.id
			}
		}
	}
	
	var fixMozilla = function() {
		//fix for bug https://bugzilla.mozilla.org/show_bug.cgi?id=309550
		if (view.browser.mozilla.rv >= 1.08) {
			var fieldsets = document.getElementsByTagName('fieldset')
			for (var i = 0; i < fieldsets.length; i++) {
				fixBug309550(fieldsets[i])
			}
		}
	}
	
	var fixBug309550 = function(parent) {
		for (var i = 0; i < parent.childNodes.length; i++) {
			if (parent.childNodes[i].nodeType == 1) {
				if (parent.childNodes[i].hasChildNodes && parent.childNodes[i].tagName != 'FIELDSET') {
					if (fixBug309550(parent.childNodes[i])) return true
				}
				if (parent.childNodes[i].clear != 'none') {
					var div = document.createElement('div')
					div.style.clear = parent.childNodes[i].clear
					div.style.overflow = 'hidden'
					parent.insertBefore(div, parent.childNodes[i])
					return true
				}
			}
		}
	}
	*/
}
view.colors = new function() {
	var colors = {
		disabled: '#D4D0C8',
		focused: '#F4EED5',
		rollOver: '#C2CDDF',
		selected: '#FFE1B1',
		invalid: '#FF6262',
		possiblyValid: 'Purple'
		
	}
	
	this.get = function(color) {
		/*if (!colors) {
			colors = {}
			var rules = Prototype.Browser.IE ? document.styleSheets[0].rules : document.styleSheets[0].cssRules
			for (var i = 0; i < rules.length; i++) {
				var maches = rules[i].selectorText.match(/^\.colors\s+\.(\w+)$/)
				if (maches && rules[i].style.color) {
					colors[maches[1]] = rules[i].style.color
				}
			}
		}*/
		return colors[color]
	}
}
var Controller = Class.create(Observable, {	
	initialize: function(args) {
		this.controller = args.controller
		this.action = args.action
		this.request = Object.extend(args.request, Controller.Request)
        this.authenticity_token = args.authenticity_token
		this.user = args.user
		this.jsToInit = args.jsToInit
		
		this.observers = [] //for Observable
	},
	
	start: function() {
		//view.preSetUp()
		
		// iniciamos los objetos especificados en jsToInit
		for (var i = 0, l = this.jsToInit.length; i < l; i++) {
			switch (this.jsToInit[i][0]) {
				case 'v': //set variable
					this[this.jsToInit[i][1]] = this.jsToInit[i][2]
					break
				case 'c': //function call
				case 'i': //class instantiation
					var properties = this.jsToInit[i][2].split('.')
					var functionObject = window
					for (var j = 0, m = properties.length; j < m; j++) {
						functionObject = functionObject[properties[j]]
						if (!functionObject) break
					}
					if (!functionObject instanceof Function || functionObject == window) throw("Function object '" + this.jsToInit[i][2] + "' not found")
					var a = this.jsToInit[i][3] || []
					var result = this.jsToInit[i][0] == 'c' ? functionObject.apply(window, a) : new functionObject(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9])
					if (this.jsToInit[i][1]) this[this.jsToInit[i][1]] = result
					break
				default:
					throw("Unsupported jsToInit type code '" + this.jsToInit[i][0] + "'")
			}
		}
		//call action
		var camelizedAction
		var parts = this.action.split('_')
		if (parts[1]) {
			camelizedAction = parts[0]
			for (var i = 1, l = parts.length; i < l; i++) {
				var part = parts[i]
				camelizedAction += part.substr(0, 1).toUpperCase() + part.substr(1)
			}
			
		} else {
			camelizedAction = this.action
		}
		if (this[camelizedAction]) this[camelizedAction]()
		
		//view.postSetUp()
				
		this.notifyEventToObservers(Controller.ON_END)
	},
	
	urlFor: function(options) {
		options = Object.extend({}, options)
		var parts = [options.controller || this.controller]
		parts.push(options.action || this.action)
		if (options.id) parts.push(options.id)
		delete options.controller
		delete options.action
		delete options.id
		var query = $H(options).toQueryString()
		return '/' + parts.join('/') + (query.length ? '?' + query : '')
	}
	/*
	parseURI: function(uri) {
		ABS_URI = /^([a-zA-Z][-+.a-zA-Z\d]*):(?:((?:[-_.!~*'()a-zA-Z\d;?:@&=+$,]|%[a-fA-F\d]{2})(?:[-_.!~*'()a-zA-Z\d;\/?:@&=+$,\[\]]|%[a-fA-F\d]{2})*)|(?:(?:\/\/(?:(?:(?:((?:[-_.!~*'()a-zA-Z\d;:&=+$,]|%[a-fA-F\d]{2})*)@)?(?:((?:(?:(?:[a-zA-Z\d](?:[-a-zA-Z\d]*[a-zA-Z\d])?)\.)*(?:[a-zA-Z](?:[-a-zA-Z\d]*[a-zA-Z\d])?)\.?|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[(?:(?:[a-fA-F\d]{1,4}:)*(?:[a-fA-F\d]{1,4}|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})|(?:(?:[a-fA-F\d]{1,4}:)*[a-fA-F\d]{1,4})?::(?:(?:[a-fA-F\d]{1,4}:)*(?:[a-fA-F\d]{1,4}|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}))?)\]))(?::(\d*))?))?|((?:[-_.!~*'()a-zA-Z\d$,;+@&=+]|%[a-fA-F\d]{2})+))|(?!\/\/))(\/(?:[-_.!~*'()a-zA-Z\d:@&=+$,]|%[a-fA-F\d]{2})*(?:;(?:[-_.!~*'()a-zA-Z\d:@&=+$,]|%[a-fA-F\d]{2})*)*(?:\/(?:[-_.!~*'()a-zA-Z\d:@&=+$,]|%[a-fA-F\d]{2})*(?:;(?:[-_.!~*'()a-zA-Z\d:@&=+$,]|%[a-fA-F\d]{2})*)*)*)?)(?:\?((?:[-_.!~*'()a-zA-Z\d;\/?:@&=+$,\[\]]|%[a-fA-F\d]{2})*))?)(?:\#((?:[-_.!~*'()a-zA-Z\d;\/?:@&=+$,\[\]]|%[a-fA-F\d]{2})*))?$/
		REL_URI = /^(?:(?:\/\/(?:(?:((?:[-_.!~*'()a-zA-Z\d;:&=+$,]|%[a-fA-F\d]{2})*)@)?((?:(?:(?:[a-zA-Z\d](?:[-a-zA-Z\d]*[a-zA-Z\d])?)\.)*(?:[a-zA-Z](?:[-a-zA-Z\d]*[a-zA-Z\d])?)\.?|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[(?:(?:[a-fA-F\d]{1,4}:)*(?:[a-fA-F\d]{1,4}|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})|(?:(?:[a-fA-F\d]{1,4}:)*[a-fA-F\d]{1,4})?::(?:(?:[a-fA-F\d]{1,4}:)*(?:[a-fA-F\d]{1,4}|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}))?)\]))?(?::(\d*))?|((?:[-_.!~*'()a-zA-Z\d$,;+@&=+]|%[a-fA-F\d]{2})+)))|((?:[-_.!~*'()a-zA-Z\d;@&=+$,]|%[a-fA-F\d]{2})+))?(\/(?:[-_.!~*'()a-zA-Z\d:@&=+$,]|%[a-fA-F\d]{2})*(?:;(?:[-_.!~*'()a-zA-Z\d:@&=+$,]|%[a-fA-F\d]{2})*)*(?:\/(?:[-_.!~*'()a-zA-Z\d:@&=+$,]|%[a-fA-F\d]{2})*(?:;(?:[-_.!~*'()a-zA-Z\d:@&=+$,]|%[a-fA-F\d]{2})*)*)*)?(?:\?((?:[-_.!~*'()a-zA-Z\d;\/?:@&=+$,\[\]]|%[a-fA-F\d]{2})*))?(?:\#((?:[-_.!~*'()a-zA-Z\d;\/?:@&=+$,\[\]]|%[a-fA-F\d]{2})*))?$/
		var matches
		if (matches = uri.match(ABS_URI)) {
			parts = {
				scheme: matches[1], 
      			userinfo: matches[3],
      			host: matches[4],
      			port: matches[5],
				registry: matches[6],
				path: matches[7],
				opaque: matches[2],
				query: matches[8],
				fragment: matches[9]
			}
			if (!parts.scheme) {
				throw("URI absolute but no scheme '" + uri + "'")
			} if (!parts.opaque && (!parts.path && (!parts.host && !parts.registry))) {
				throw("URI absolute but no path '" + uri + "'")
			}
		} else if (matches = uri.match(REL_URI)) {
			parts = {
				scheme: null, 
      			userinfo: matches[1],
      			host: matches[2],
      			port: matches[3],
				registry: matches[4],
				path: matches[5] && matches[6] ? matches[5] + matches[6] : matches[5] || matches[6],
				opaque: null,
				query: matches[7],
				fragment: matches[8]
			}
		} else {
			throw("Invalid URI '" + uri + "'")
		}
		if (!parts.path && !parts.opaque) parts.path = ''
		return parts
	}
	*/
})
Object.extend(Controller, {
	ON_END: 10, // evento lanzado al completar la inicializacion
	
	start: function(args) {
		window.controller = new Controller(args)
		window.controller.start()
	}
})
Controller.Request = {
	get: function(args) {
		return this.method == 'get' ? true : false
	},
	post: function(args) {
		return this.method == 'post' ? true : false
	}
}
var IP = {
	//http://www.iana.org/assignments/ipv4-address-space
	reserved: [
		[0,50331647],
		[83886080,100663295],
		[117440512,134217727],
		[167772160,184549375],
		[385875968,402653183],
		[452984832,469762047],
		[520093696,536870911],
		[603979776,637534207],
		[654311424,671088639],
		[704643072,721420287],
		[822083584,855638015],
		[1291845632,1342177279],
		[1543503872,2080374783],
		[2130706432,2147483647],
		[-1392508928,-1140850689],
		[-989855744,-973078529],
		[-553648128,-1],
		// IP privadas excepto 10.0.0.0/10.255.255.255 que esta arriba
		[-1408237568,-1407188993],
		[-1062731776,-1062666241],
		[-1442971648,-1442906113]
	],
	
	isPublicIp: function(ip) {
		ip = ip.split('.').collect(function(p) { return parseInt(p) })
		ip = ip[0] << 24 + ip[1] << 16 + ip[2] << 8 + ip[3]
		for (var i= 0; i < this.reserved.length; i++) {
			if (ip >= this.reserved[i][0] && ip <= this.reserved[i][1]) return false
		}
		return true
	}
}
var Validator = Class.create()
Object.extend(Validator, {
	PREDEFINED_FORMATS: {
		text:			/^[^\f\n\r\t\v]+$/,
		multiline_text: /^[^\f\t\v]+$/,
		url:			/^(?:[a-z]+:\/\/)?(?:[-0-9a-z]*\.)*[-0-9a-z]{2,}\.[a-z]{2,4}(?:\/[-_\/\.\?\(\)#=&%0-9a-zA-Z]*)?$/
	},
	
	NOT_VALIDATED: 0,
	INVALID: 1,
	POSSIBLY_VALID: 2,
	VALID: 3,
	
	ON_REMOTE_SUCCESS: 1,
	
	ERROR: {
		empty: _("No has rellenado %fn"),
		mustBeInteger: _("%fn debe ser un número entero"),
		mustBeUnsigned: _("%fn debe ser un número positivo"),
		mustBeNumber: _("%fn debe ser un número"),
		wrongLength: _("%fn tiene %d carácteres y debe tener exactamente %d"),
		lengthTooShort: _("%fn es demasiado corto (tiene %d carácteres y el mínimo es %d)"),
		lengthTooLong: _("%fn es demasiado largo (tiene %d carácteres y el máximo es %d)"),
		invalidFormat: _("%fn no tiene un formato válido"),
		notAllowed: _("%fn tiene el valor no permitido %fv"),
		reserved: _("%fn tiene el valor reservado %fv"),
		notConfirmed: _("El valor %p de %fn no coincide con el valor de confirmación %p"),
		mustBeAccepted : _("%fn debe ser aceptado"),
		taken: _("%fn ya esta ocupado"),
		nonexistent: _("%fn no existe"),
		contentTypeNotAllowed: _("El tipo de contenido %p de %fn no está permitido"),
		sizeTooShort: _("El tamaño del fichero de %fn es pequeño (tiene %d Kb. y el mínimo es %d)"),
		sizeTooLong: _("El tamaño del fichero de %fn es excesivo (tiene %d y el máximo es %d)"),
		invalid: _("%fn no es válido")
	}
})
Object.extend(Validator.prototype, Observable)
Object.extend(Validator.prototype, {
	statusColours: ['', view.colors.get('invalid'), view.colors.get('possiblyValid'), ''],
	
	initialize: function(form, showWaitLayer) {
		this.observers = [] //for Observable
		
		this.form = form
		this.showWaitLayer = showWaitLayer == undefined ? true : false
		this.fields = []
		this.errors = []
        
        this.onRemoteSuccess = this.onRemoteSuccess.bind(this)

		Event.observe(this.form, 'submit', this.onSubmit.bind(this))
	},
	
	validates: function(field, name, rules, block) {
		if (!rules) rules = {}
		if (this.fields.include(field)) {
			Object.extend(field.validates.rules, rules)
		} else {
			this.fields.push(field)
			if (this.fields.length) {
				//order fields array in layout order
				this.fields = $A(this.form.getElementsByTagName('*')).collect(function(elm) {
					if (elm.tagName.toLowerCase() == 'input' && elm.type == 'radio' && elm == elm.form[elm.name][elm.form[elm.name].length - 1]) {
						elm = elm.form[elm.name]
					}
					return this.fields.include(elm) ? elm : null
				}.bind(this)).compact()
			}
			if (!field.form) field.form = this.form
			field.validates = {
				name: name || field.name || field.id,
				rules: Object.extend({}, rules),
				status: Validator.NOT_VALIDATED
			}
		    if (rules.remote) {
				if (typeof(rules.remote) == 'string') field.validates.rules.remote = {url: rules.remote}
	    		field.validates.remote = new Validator.Remote(this, field, field.validates.rules.remote)
	    	}
	    	if (block) {
	    		if (typeof block == 'function') {
	    			field.validates.block = block
	    		} else {
	    			throw "'block' argument must be a 'Function' object"
	    		}
	    	}
			if (field.tagName) {
				if (field.type == 'text' || field.type == 'password') {
					Event.observe(field, 'keyup', this.onChangeField.bind(field))
				} else {
					Event.observe(field, 'change', this.onChangeField.bind(field))
				}
			} else { // can be a collection of <input type="radio"/>
				for (var i = 0; i < field.length; i++) {
					Event.observe(field[i], 'change', this.onChangeField.bind(field))
				}
			}
			//predefineds
			if (rules.confirm) {
				var confirm_field = rules.confirm
				delete(field.validates.rules.confirm)
				this.validates(confirm_field, field.validates.name + ' ' + _('confirmation'), Object.extend({}, field.validates.rules), block)
				this.validatesRelated(field, confirm_field, field.validates.name, {}, function(error) {
					if (confirm_field.value.strip() != field.value.strip()) {
						return error(Validator.ERROR.notConfirmed, field.value.strip(), confirm_field.value.strip())
					}
					return true
				})
			}
		}
	},
	
	validatesRelated: function() { //[field, ...], name, rules, block
		var fields, name, rules, block
		var args = $A(arguments)
		var arg = args.pop()
		if (arg instanceof Function) {
			block = arg
			arg = args.pop()
		}
		if (typeof(arg) == 'object') {
			rules = arg
			arg = args.pop()
		}
		if (typeof(arg) == 'string') name = arg
		var fields = args
		//alert($H(this.form.elements).inspect())
		/*fields.sort(function(a, b) {
			var result = 0
			$A(this.form.elements).each(function(element) {
				if (element == a || element == b) {
					result = element == a ? 1 : -1
					throw $break
				}
			})
			return result
		}.bind(this))*/

		var related = new Validator.Related(this, fields, name, rules, block)
		for (var i = 0; i < fields.length; i++) {
			fields[i].validates.related = related
		}
	},
	
	validate: function(field, changeEvent) {
		if (field) {
			var status
			if (field.validates.related) {
				status = this.validateRelated(field.validates.related, changeEvent)
				field.validates.related.fields.each(function(field) { this.showStatus(field) }.bind(this))
			} else {
				status = this.validateField(field, changeEvent)
				this.showStatus(field)
			}
			return status
		} else { //validate all fields in the form
			return this.fields.inject(Validator.VALID, function(status, field) {
				var result = this.validate(field)
				return result < status ? result : status
			}.bind(this))
		}
	},
	
	validateField: function(field, performRemote) {
		var status = field.validates.status
		if (status == Validator.NOT_VALIDATED) {
			status = Validator.INVALID
			var value = this.getValue(field)
			var rules = field.validates.rules
			if (typeof value == 'string') {
				value = rules.strip == false ? value : value.strip()
			} else {
				value = value == undefined ? '' : value
			}
			var error = function(message) {
				return this.addError.apply(this, [field].concat($A(arguments)))
			}.bind(this)
			if (rules.filled == 'optional' && !value.length) {
				status = Validator.VALID
			} else if (!value.length) {
				error(Validator.ERROR.empty)
	        } else if ((rules.number == 'integer' || rules.number == 'unsigned_integer') && !value.match(/^-?\d+$/)) {
				error(Validator.ERROR.mustBeInteger)
	        } else if ((rules.number == 'unsigned' || rules.number == 'unsigned_integer') && !value.match(/^\d+(?:\.\d+)?$/)) {
				error(Validator.ERROR.mustBeUnsigned)
	        } else if (rules.number && !value.match(/^-?\d+(?:\.\d+)?$/)) {
				error(Validator.ERROR.mustBeNumber)
	        } else if (typeof(rules.length) == 'number' && value.length != rules.length) {
				error(Validator.ERROR.wrongLength, value.length, rules.length)
	        } else if (rules.length && rules.length.min && value.length < rules.length.min) {
				error(Validator.ERROR.lengthTooShort, value.length, rules.length.min)
	        } else if (rules.length && rules.length.max && value.length > rules.length.max) {
				error(Validator.ERROR.lengthTooLong, value.length, rules.length.max)
	        } else if (rules.format && !value.match(typeof(rules.format) == 'string' ? Validator.PREDEFINED_FORMATS[rules.format] : rules.format)) {
				error(Validator.ERROR.invalidFormat)
			} else if (rules.include && !rules.include.include(value)) {
				error(Validator.ERROR.notAllowed)
	        } else if (rules.exclude && rules.exclude.include(value)) {
				error(Validator.ERROR.reserved)
	        } else if (field.validates.block && !field.validates.block.call(this, error)) {
	        } else if (rules.remote && value != field.defaultValue) { // && performRemote
				var result = field.validates.remote.validate()
				status = result.status
				if (status == Validator.INVALID) error(result.message)
	        } else {
	        	status = Validator.VALID
	        }
	        if (status > Validator.INVALID) this.clear(field)
			field.validates.status = status
		}
		return status
	},
	
	validateRelated: function(related, performRemote) {
		var status = related.status
		if (status == Validator.NOT_VALIDATED) {
			status = related.fields.collect(function(f) { return this.validateField(f, performRemote) }.bind(this)).min()
			if (status == Validator.VALID) {
				var error = function() {
					this.addError.apply(this, typeof arguments[0] == 'string' ? [related].concat($A(arguments)) : arguments)
					return false
				}.bind(this)
				var value
				if (related.block && !related.block(error)) {
					status = Validator.INVALID
				} else if (related.remote && this.getValue(related) != related.defaultValue) { //&& performRemote
					var result = related.remote.validate()
					status = result.status
					if (status == Validator.INVALID) error(result.message)
				}
		        if (status > Validator.INVALID) this.clear(related)
			} else if (status == Validator.INVALID) {
				this.clear(related) //clear errors of related object because exists field errors
			}
			related.status = status
		}
		return status
	},
	
	onChangeField: function(event) {
		event = event || window.event
		//if (event.type == 'keyup') alert(String.fromCharCode(event.keyCode).toLowerCase())
		this.validates.status = Validator.NOT_VALIDATED
		if (this.validates.related) {
			this.validates.related.status = Validator.NOT_VALIDATED
		}
		this.form.validator.validate(this, event.type == 'change' ? true : false)
	},
	
	onSubmit: function(event) {
		//if (Form.isEmpty(this.form)) {
		//	var field = Form.findFirstElement(this.form)
		//	if (this.form.tabs) this.form.tabs.activate(Controls.Tabs.getTabOfNode(field))
		//	alert(_("Please, fill the form"))
		//	Field.activate(field)
		//} else {
		switch (this.validate()) {
			case Validator.VALID:
				if (this.showWaitLayer) view.waitLayer.show(_("Enviando..."))
				return
			case Validator.POSSIBLY_VALID:
				this.observe(Validator.ON_REMOTE_SUCCESS, this.onRemoteSuccess)
				if (this.showWaitLayer) view.waitLayer.show(_("Por favor, espera...\nSe está VALIDANDO la información (puede tardar hasta 25 segundos)."))
				Event.stop(event || window.event)
				break
			case Validator.INVALID:
				var field = this.firstWrongField()
				if (this.form.tabs) this.form.tabs.activate(View.Controls.Tabs.getTabOfNode(field))
				alert(this.getErrors().join('\n'))
				Field.activate(field)
				Event.stop(event || window.event)
		}
		//}
	},
	
	onRemoteSuccess: function() {
		//alert(Validator.Remote.remoting[0].name + ',' + Validator.Remote.remoting[1].name)
		if (!Validator.Remote.remoting.length) {
			this.stopObserving(Validator.ON_REMOTE_SUCCESS, this.onRemoteSuccess)
			if (this.showWaitLayer) view.waitLayer.hide()
            setTimeout(function() { Event.fire(this.form, 'submit');this.form.submit() }.bind(this), 300)
			
		}
	},
	
	remoteCompleted: function(target, result) {
		if (target instanceof Validator.Related) { //is a Related object
			var related = target
			related.status = result.status
			if (result.status == Validator.INVALID) this.addError(related, result.message)
			this.validate(related.fields[0])
		} else {
			var field = target
			field.validates.status = result.status
			if (result.status == Validator.INVALID) this.addError(field, result.message)
			this.validate(field)
		}
		this.notifyEventToObservers(Validator.ON_REMOTE_SUCCESS)
	},
	
	clear: function(target) {
		if (target) {
			this.errors.each(function(error, index) {
				if (error[0] == target) {
					this.errors.splice(index, 1)
					throw $break
				}
			}.bind(this))
		} else {
			this.errors = []
		}
	},

	valid: function(field) {
		if (field) {
			this.validate(field)
			return this.errors.detect(function(e) { return e[0] == field }) ? false : true
		} else {
			this.validate()
			return this.errors.length ? false : true
		}
	},
      
    addError: function(target, message) {
		var index = -1
		if (this.errors.length) {
			this.errors.detect(function(e, i) { if (e[0] == target) { index = i; return true } })
			if (index > -1) this.errors[index] = $A(arguments)
		}
		if (index == -1) this.errors.push($A(arguments))
    	return false
    },
	
	getErrors: function(target) {
		if (!target) this.sortErrors()
		return this.errors.collect(function(e) {
			if (!target || e[0] == target) {
				return this.prepareErrorMessage.apply(this, e)
			} else {
				return null
			}
		}.bind(this)).compact()
	},
	
	showStatus: function(field) {
		var status = field.validates.related ? field.validates.related.status : field.validates.status
		if (field.tagName) {
			field.style.color = field.style.borderColor = this.statusColours[status]
		} else {
			for (var i = 0; i < field.length; i++) {
				field[i].style.color = field[i].style.borderColor = this.statusColours[status]
			}
		}
		var title
		if (status == Validator.INVALID) {
			var errors = this.getErrors(field)
			if (!errors.length && field.validates.related) {
				errors = this.getErrors(field.validates.related)
				if (!errors.length) {
					var invalidRelatedField = field.validates.related.fields.detect(function(f) { return f.validates.status == Validator.INVALID ? true : false })
					errors = invalidRelatedField ? [_("Mira los errores del campo relacionado") + ' ' + invalidRelatedField.validates.name.toUpperCase()] : []
				}
			}
			title = errors.join(', ')
		} else {
			title = ''
		}
		if (field.tagName) {
			field.title = title
		} else {
			for (var i = 0; i < field.length; i++) {
				field[i].title = title
			}
		}
	},
	
	prepareErrorMessage: function(target, message) {
		if (target) {
			var name = target.validates ? target.validates.name : target.name
			message = message.replace(/%fn/g, name.toUpperCase()).replace(/%fv/g, this.getValue(target).inspect())
		}
		if (arguments[2]) message = message.sprintf.apply(message, $A(arguments).slice(2))
        return message
	},
	
	getValue: function(target) {
		var value = ''
		if (target.tagName) {
			var field = target
			switch (field.tagName.toLowerCase()) {
				case 'input':
					switch (field.type) {
						case 'checkbox':
						case 'radio':
							if (field.form[field.name] == field) {
								if (!field.checked) {
									break
								}
							} else {
								value = Form.Field.getValue(field.form[field.name])
							}
						default:
							value = field.value
					}
					break
				case 'textarea':
					value = field.value
					if (field.validates.rules.stripTags) value = value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').strip()
					break
				case 'select':
					if (field.type == 'select-one') {
						if (field.selectedIndex > -1) {
							value = 'value' in field.options[field.selectedIndex] ? field.options[field.selectedIndex].value : field.options[field.selectedIndex].text
						}
					} else {
						value = []
						for (var i = 0; i < field.options.length; i++) {
							field.options[i].selected && value.push('value' in field.options[i] ? field.options[i].value : field.options[i].text)
						}
					}
			}
		} else if (target.fields) { //is a Related object
			var related = target
			value = related.fields.inject([], function(m, f) { m.push(this.getValue(f)); return m }.bind(this)).join(' ')
		} else { // is a collection of radio buttons
			var inputs = target
			switch (inputs[0].type) {
				case 'checkbox':
					value = []
					for (var i = 0; i < inputs.length; i++) {
						if (inputs[i].checked) value.push(inputs[i].value)
					}
					break
				case 'radio':
					for (var i = 0; i < inputs.length; i++) {
						if (inputs[i].checked) {
							value = inputs[i].value
							break
						}
					}
					break
				default:
					throw('Unsupported field type ' + inputs[0].type)
			}
		}
		return value
	},
	
	sortErrors: function() {
		this.errors.sort(function(a, b) {
			a = a[0]
			if (a.fields) a = a.fields.last() //is a Related object
			b = b[0]
			if (b.fields) b = b.fields.last()
			return this.fields.detect(function(field) { return field == a || field == b	}) == a ? -1 : 1
		}.bind(this))
	},
	
	firstWrongField: function() {
		this.sortErrors()
		return this.errors[0][0].tagName ? this.errors[0][0] : (this.errors[0][0].fields ? this.errors[0][0].fields[0] : this.errors[0][0])
	}
})
Validator.Related = Class.create()
Object.extend(Validator.Related.prototype, {
	initialize: function(validator, fields, name, rules, block) {
		this.fields = fields
		this.name = name
		this.rules = rules || {}
		this.block = block
		this.status = Validator.NOT_VALIDATED
		this.defaultValue = fields.collect(function(f) { return 'defaultValue' in f ? f.defaultValue : f.value }).join(' ')
		
	    if (rules.remote) this.remote = new Validator.Remote(validator, this, this.rules.remote)
	}
})
Validator.Remote = Class.create()
Object.extend(Validator.Remote, {
	remoting: [] //controls who is runing a remote request
})
Object.extend(Validator.Remote.remoting, {
	started: function(target) {
		this.push(target)
	},
	
	stopped: function(target) {
		this.splice(this.indexOf(target), 1)
	}
})
Object.extend(Validator.Remote.prototype, {
	initialize: function(validator, target, url) {
		this.validator = validator
		this.target = target
		this.url = url
		this.timeout = null
		this.request = {}
		this.response = {}
	},
	
	clear: function() {
		clearTimeout(this.timeout)
		this.request = {}
		this.response = {}
	},
	
	validate: function() {
		var status = Validator.POSSIBLY_VALID
		var message = null
		var value = this.validator.getValue(this.target).strip()
		if (!this.request[value]) { //bypass if remote validation for this value is already running
			clearTimeout(this.timeout) //stop any programmed remote validation
			//dump("\n%s: %s = cancelado ultimo timeout".sprintf(field.name, value.inspect()) + "\n")
   			if (this.response[value]) { //check for cached validation for this value
   				//dump("%s: %s = validado desde cache".sprintf(field.name, value.inspect()) + "\n")
   				status = this.response[value].status
   				if (status == Validator.INVALID) message = this.response[value].message
   			} else {
   			    //dump("%s: %s = establecido timeout".sprintf(field.name, value.inspect()) + "\n")
       			this.timeout = setTimeout(this.makeRequest.bind(this, value), 750)
        	}
		}
		return {status: status, message: message}
	},

	makeRequest: function(value) {
		Validator.Remote.remoting.started(this.target)
		var parameters = {}
		for (var param in this.url.params) {
			parameters[param] = typeof(this.url.params[param]) == 'function' ? this.url.params[param]() : this.url.params[param]
		}		
		parameters.authenticity_token = controller.authenticity_token
		if (this.target instanceof Validator.Related) {
			for (var i = 0; i < this.target.fields.length; i++) {
				var field = this.target.fields[i]
				parameters[field.name || field.id] = this.validator.getValue(field)
			}
		} else {
			parameters[this.target.name || this.target.id] = value
		}
		//dump("%s: %s = enviada validacion".sprintf(field.name, value.inspect()) + "\n")
    	this.request[value] = new Ajax.Request(this.url.url, {
    		parameters: parameters,
			onComplete: function(value, request, json) {
				delete(this.request[value])
				Validator.Remote.remoting.stopped(this.target)
				if (json) {
					//dump("%s: %s = resultado almacenado".sprintf(field.name, value.inspect()) + "\n")
					this.response[value] = json.result ? {status: Validator.VALID} : {status: Validator.INVALID, message: json.message}
					if (value != this.validator.getValue(this.target).strip()) return // el usuario ha modificado el campo durante la validación remota
					//dump("%s: %s = resultado utilizado".sprintf(field.name, value.inspect()) + "\n")
				} else {
					this.response[value] = {status: Validator.VALID}
					alert("Se ha producido un error al intentar validar remotamente los datos.\n\nInformación de depuración:\n" + request.responseText.match(/<h1>[\s\S]+?<\/p>/))
				}
				this.validator.remoteCompleted(this.target, this.response[value])
			}.bind(this, value)
    	}).transport
	}
})