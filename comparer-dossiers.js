/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 380:
/***/ ((module) => {

"use strict";

module.exports = balanced;
function balanced(a, b, str) {
  if (a instanceof RegExp) a = maybeMatch(a, str);
  if (b instanceof RegExp) b = maybeMatch(b, str);

  var r = range(a, b, str);

  return r && {
    start: r[0],
    end: r[1],
    pre: str.slice(0, r[0]),
    body: str.slice(r[0] + a.length, r[1]),
    post: str.slice(r[1] + b.length)
  };
}

function maybeMatch(reg, str) {
  var m = str.match(reg);
  return m ? m[0] : null;
}

balanced.range = range;
function range(a, b, str) {
  var begs, beg, left, right, result;
  var ai = str.indexOf(a);
  var bi = str.indexOf(b, ai + 1);
  var i = ai;

  if (ai >= 0 && bi > 0) {
    if(a===b) {
      return [ai, bi];
    }
    begs = [];
    left = str.length;

    while (i >= 0 && !result) {
      if (i == ai) {
        begs.push(i);
        ai = str.indexOf(a, i + 1);
      } else if (begs.length == 1) {
        result = [ begs.pop(), bi ];
      } else {
        beg = begs.pop();
        if (beg < left) {
          left = beg;
          right = bi;
        }

        bi = str.indexOf(b, i + 1);
      }

      i = ai < bi && ai >= 0 ? ai : bi;
    }

    if (begs.length) {
      result = [ left, right ];
    }
  }

  return result;
}


/***/ }),

/***/ 691:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

var concatMap = __nccwpck_require__(87);
var balanced = __nccwpck_require__(380);

module.exports = expandTop;

var escSlash = '\0SLASH'+Math.random()+'\0';
var escOpen = '\0OPEN'+Math.random()+'\0';
var escClose = '\0CLOSE'+Math.random()+'\0';
var escComma = '\0COMMA'+Math.random()+'\0';
var escPeriod = '\0PERIOD'+Math.random()+'\0';

function numeric(str) {
  return parseInt(str, 10) == str
    ? parseInt(str, 10)
    : str.charCodeAt(0);
}

function escapeBraces(str) {
  return str.split('\\\\').join(escSlash)
            .split('\\{').join(escOpen)
            .split('\\}').join(escClose)
            .split('\\,').join(escComma)
            .split('\\.').join(escPeriod);
}

function unescapeBraces(str) {
  return str.split(escSlash).join('\\')
            .split(escOpen).join('{')
            .split(escClose).join('}')
            .split(escComma).join(',')
            .split(escPeriod).join('.');
}


// Basically just str.split(","), but handling cases
// where we have nested braced sections, which should be
// treated as individual members, like {a,{b,c},d}
function parseCommaParts(str) {
  if (!str)
    return [''];

  var parts = [];
  var m = balanced('{', '}', str);

  if (!m)
    return str.split(',');

  var pre = m.pre;
  var body = m.body;
  var post = m.post;
  var p = pre.split(',');

  p[p.length-1] += '{' + body + '}';
  var postParts = parseCommaParts(post);
  if (post.length) {
    p[p.length-1] += postParts.shift();
    p.push.apply(p, postParts);
  }

  parts.push.apply(parts, p);

  return parts;
}

function expandTop(str) {
  if (!str)
    return [];

  // I don't know why Bash 4.3 does this, but it does.
  // Anything starting with {} will have the first two bytes preserved
  // but *only* at the top level, so {},a}b will not expand to anything,
  // but a{},b}c will be expanded to [a}c,abc].
  // One could argue that this is a bug in Bash, but since the goal of
  // this module is to match Bash's rules, we escape a leading {}
  if (str.substr(0, 2) === '{}') {
    str = '\\{\\}' + str.substr(2);
  }

  return expand(escapeBraces(str), true).map(unescapeBraces);
}

function identity(e) {
  return e;
}

function embrace(str) {
  return '{' + str + '}';
}
function isPadded(el) {
  return /^-?0\d/.test(el);
}

function lte(i, y) {
  return i <= y;
}
function gte(i, y) {
  return i >= y;
}

function expand(str, isTop) {
  var expansions = [];

  var m = balanced('{', '}', str);
  if (!m || /\$$/.test(m.pre)) return [str];

  var isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
  var isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
  var isSequence = isNumericSequence || isAlphaSequence;
  var isOptions = m.body.indexOf(',') >= 0;
  if (!isSequence && !isOptions) {
    // {a},b}
    if (m.post.match(/,(?!,).*\}/)) {
      str = m.pre + '{' + m.body + escClose + m.post;
      return expand(str);
    }
    return [str];
  }

  var n;
  if (isSequence) {
    n = m.body.split(/\.\./);
  } else {
    n = parseCommaParts(m.body);
    if (n.length === 1) {
      // x{{a,b}}y ==> x{a}y x{b}y
      n = expand(n[0], false).map(embrace);
      if (n.length === 1) {
        var post = m.post.length
          ? expand(m.post, false)
          : [''];
        return post.map(function(p) {
          return m.pre + n[0] + p;
        });
      }
    }
  }

  // at this point, n is the parts, and we know it's not a comma set
  // with a single entry.

  // no need to expand pre, since it is guaranteed to be free of brace-sets
  var pre = m.pre;
  var post = m.post.length
    ? expand(m.post, false)
    : [''];

  var N;

  if (isSequence) {
    var x = numeric(n[0]);
    var y = numeric(n[1]);
    var width = Math.max(n[0].length, n[1].length)
    var incr = n.length == 3
      ? Math.abs(numeric(n[2]))
      : 1;
    var test = lte;
    var reverse = y < x;
    if (reverse) {
      incr *= -1;
      test = gte;
    }
    var pad = n.some(isPadded);

    N = [];

    for (var i = x; test(i, y); i += incr) {
      var c;
      if (isAlphaSequence) {
        c = String.fromCharCode(i);
        if (c === '\\')
          c = '';
      } else {
        c = String(i);
        if (pad) {
          var need = width - c.length;
          if (need > 0) {
            var z = new Array(need + 1).join('0');
            if (i < 0)
              c = '-' + z + c.slice(1);
            else
              c = z + c;
          }
        }
      }
      N.push(c);
    }
  } else {
    N = concatMap(n, function(el) { return expand(el, false) });
  }

  for (var j = 0; j < N.length; j++) {
    for (var k = 0; k < post.length; k++) {
      var expansion = pre + N[j] + post[k];
      if (!isTop || isSequence || expansion)
        expansions.push(expansion);
    }
  }

  return expansions;
}



/***/ }),

/***/ 87:
/***/ ((module) => {

module.exports = function (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        var x = fn(xs[i], i);
        if (isArray(x)) res.push.apply(res, x);
        else res.push(x);
    }
    return res;
};

var isArray = Array.isArray || function (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};


/***/ }),

/***/ 772:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

module.exports = minimatch
minimatch.Minimatch = Minimatch

var path = (function () { try { return __nccwpck_require__(928) } catch (e) {}}()) || {
  sep: '/'
}
minimatch.sep = path.sep

var GLOBSTAR = minimatch.GLOBSTAR = Minimatch.GLOBSTAR = {}
var expand = __nccwpck_require__(691)

var plTypes = {
  '!': { open: '(?:(?!(?:', close: '))[^/]*?)'},
  '?': { open: '(?:', close: ')?' },
  '+': { open: '(?:', close: ')+' },
  '*': { open: '(?:', close: ')*' },
  '@': { open: '(?:', close: ')' }
}

// any single thing other than /
// don't need to escape / when using new RegExp()
var qmark = '[^/]'

// * => any number of characters
var star = qmark + '*?'

// ** when dots are allowed.  Anything goes, except .. and .
// not (^ or / followed by one or two dots followed by $ or /),
// followed by anything, any number of times.
var twoStarDot = '(?:(?!(?:\\\/|^)(?:\\.{1,2})($|\\\/)).)*?'

// not a ^ or / followed by a dot,
// followed by anything, any number of times.
var twoStarNoDot = '(?:(?!(?:\\\/|^)\\.).)*?'

// characters that need to be escaped in RegExp.
var reSpecials = charSet('().*{}+?[]^$\\!')

// "abc" -> { a:true, b:true, c:true }
function charSet (s) {
  return s.split('').reduce(function (set, c) {
    set[c] = true
    return set
  }, {})
}

// normalizes slashes.
var slashSplit = /\/+/

minimatch.filter = filter
function filter (pattern, options) {
  options = options || {}
  return function (p, i, list) {
    return minimatch(p, pattern, options)
  }
}

function ext (a, b) {
  b = b || {}
  var t = {}
  Object.keys(a).forEach(function (k) {
    t[k] = a[k]
  })
  Object.keys(b).forEach(function (k) {
    t[k] = b[k]
  })
  return t
}

minimatch.defaults = function (def) {
  if (!def || typeof def !== 'object' || !Object.keys(def).length) {
    return minimatch
  }

  var orig = minimatch

  var m = function minimatch (p, pattern, options) {
    return orig(p, pattern, ext(def, options))
  }

  m.Minimatch = function Minimatch (pattern, options) {
    return new orig.Minimatch(pattern, ext(def, options))
  }
  m.Minimatch.defaults = function defaults (options) {
    return orig.defaults(ext(def, options)).Minimatch
  }

  m.filter = function filter (pattern, options) {
    return orig.filter(pattern, ext(def, options))
  }

  m.defaults = function defaults (options) {
    return orig.defaults(ext(def, options))
  }

  m.makeRe = function makeRe (pattern, options) {
    return orig.makeRe(pattern, ext(def, options))
  }

  m.braceExpand = function braceExpand (pattern, options) {
    return orig.braceExpand(pattern, ext(def, options))
  }

  m.match = function (list, pattern, options) {
    return orig.match(list, pattern, ext(def, options))
  }

  return m
}

Minimatch.defaults = function (def) {
  return minimatch.defaults(def).Minimatch
}

function minimatch (p, pattern, options) {
  assertValidPattern(pattern)

  if (!options) options = {}

  // shortcut: comments match nothing.
  if (!options.nocomment && pattern.charAt(0) === '#') {
    return false
  }

  return new Minimatch(pattern, options).match(p)
}

function Minimatch (pattern, options) {
  if (!(this instanceof Minimatch)) {
    return new Minimatch(pattern, options)
  }

  assertValidPattern(pattern)

  if (!options) options = {}

  pattern = pattern.trim()

  // windows support: need to use /, not \
  if (!options.allowWindowsEscape && path.sep !== '/') {
    pattern = pattern.split(path.sep).join('/')
  }

  this.options = options
  this.set = []
  this.pattern = pattern
  this.regexp = null
  this.negate = false
  this.comment = false
  this.empty = false
  this.partial = !!options.partial

  // make the set of regexps etc.
  this.make()
}

Minimatch.prototype.debug = function () {}

Minimatch.prototype.make = make
function make () {
  var pattern = this.pattern
  var options = this.options

  // empty patterns and comments match nothing.
  if (!options.nocomment && pattern.charAt(0) === '#') {
    this.comment = true
    return
  }
  if (!pattern) {
    this.empty = true
    return
  }

  // step 1: figure out negation, etc.
  this.parseNegate()

  // step 2: expand braces
  var set = this.globSet = this.braceExpand()

  if (options.debug) this.debug = function debug() { console.error.apply(console, arguments) }

  this.debug(this.pattern, set)

  // step 3: now we have a set, so turn each one into a series of path-portion
  // matching patterns.
  // These will be regexps, except in the case of "**", which is
  // set to the GLOBSTAR object for globstar behavior,
  // and will not contain any / characters
  set = this.globParts = set.map(function (s) {
    return s.split(slashSplit)
  })

  this.debug(this.pattern, set)

  // glob --> regexps
  set = set.map(function (s, si, set) {
    return s.map(this.parse, this)
  }, this)

  this.debug(this.pattern, set)

  // filter out everything that didn't compile properly.
  set = set.filter(function (s) {
    return s.indexOf(false) === -1
  })

  this.debug(this.pattern, set)

  this.set = set
}

Minimatch.prototype.parseNegate = parseNegate
function parseNegate () {
  var pattern = this.pattern
  var negate = false
  var options = this.options
  var negateOffset = 0

  if (options.nonegate) return

  for (var i = 0, l = pattern.length
    ; i < l && pattern.charAt(i) === '!'
    ; i++) {
    negate = !negate
    negateOffset++
  }

  if (negateOffset) this.pattern = pattern.substr(negateOffset)
  this.negate = negate
}

// Brace expansion:
// a{b,c}d -> abd acd
// a{b,}c -> abc ac
// a{0..3}d -> a0d a1d a2d a3d
// a{b,c{d,e}f}g -> abg acdfg acefg
// a{b,c}d{e,f}g -> abdeg acdeg abdeg abdfg
//
// Invalid sets are not expanded.
// a{2..}b -> a{2..}b
// a{b}c -> a{b}c
minimatch.braceExpand = function (pattern, options) {
  return braceExpand(pattern, options)
}

Minimatch.prototype.braceExpand = braceExpand

function braceExpand (pattern, options) {
  if (!options) {
    if (this instanceof Minimatch) {
      options = this.options
    } else {
      options = {}
    }
  }

  pattern = typeof pattern === 'undefined'
    ? this.pattern : pattern

  assertValidPattern(pattern)

  // Thanks to Yeting Li <https://github.com/yetingli> for
  // improving this regexp to avoid a ReDOS vulnerability.
  if (options.nobrace || !/\{(?:(?!\{).)*\}/.test(pattern)) {
    // shortcut. no need to expand.
    return [pattern]
  }

  return expand(pattern)
}

var MAX_PATTERN_LENGTH = 1024 * 64
var assertValidPattern = function (pattern) {
  if (typeof pattern !== 'string') {
    throw new TypeError('invalid pattern')
  }

  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new TypeError('pattern is too long')
  }
}

// parse a component of the expanded set.
// At this point, no pattern may contain "/" in it
// so we're going to return a 2d array, where each entry is the full
// pattern, split on '/', and then turned into a regular expression.
// A regexp is made at the end which joins each array with an
// escaped /, and another full one which joins each regexp with |.
//
// Following the lead of Bash 4.1, note that "**" only has special meaning
// when it is the *only* thing in a path portion.  Otherwise, any series
// of * is equivalent to a single *.  Globstar behavior is enabled by
// default, and can be disabled by setting options.noglobstar.
Minimatch.prototype.parse = parse
var SUBPARSE = {}
function parse (pattern, isSub) {
  assertValidPattern(pattern)

  var options = this.options

  // shortcuts
  if (pattern === '**') {
    if (!options.noglobstar)
      return GLOBSTAR
    else
      pattern = '*'
  }
  if (pattern === '') return ''

  var re = ''
  var hasMagic = !!options.nocase
  var escaping = false
  // ? => one single character
  var patternListStack = []
  var negativeLists = []
  var stateChar
  var inClass = false
  var reClassStart = -1
  var classStart = -1
  // . and .. never match anything that doesn't start with .,
  // even when options.dot is set.
  var patternStart = pattern.charAt(0) === '.' ? '' // anything
  // not (start or / followed by . or .. followed by / or end)
  : options.dot ? '(?!(?:^|\\\/)\\.{1,2}(?:$|\\\/))'
  : '(?!\\.)'
  var self = this

  function clearStateChar () {
    if (stateChar) {
      // we had some state-tracking character
      // that wasn't consumed by this pass.
      switch (stateChar) {
        case '*':
          re += star
          hasMagic = true
        break
        case '?':
          re += qmark
          hasMagic = true
        break
        default:
          re += '\\' + stateChar
        break
      }
      self.debug('clearStateChar %j %j', stateChar, re)
      stateChar = false
    }
  }

  for (var i = 0, len = pattern.length, c
    ; (i < len) && (c = pattern.charAt(i))
    ; i++) {
    this.debug('%s\t%s %s %j', pattern, i, re, c)

    // skip over any that are escaped.
    if (escaping && reSpecials[c]) {
      re += '\\' + c
      escaping = false
      continue
    }

    switch (c) {
      /* istanbul ignore next */
      case '/': {
        // completely not allowed, even escaped.
        // Should already be path-split by now.
        return false
      }

      case '\\':
        clearStateChar()
        escaping = true
      continue

      // the various stateChar values
      // for the "extglob" stuff.
      case '?':
      case '*':
      case '+':
      case '@':
      case '!':
        this.debug('%s\t%s %s %j <-- stateChar', pattern, i, re, c)

        // all of those are literals inside a class, except that
        // the glob [!a] means [^a] in regexp
        if (inClass) {
          this.debug('  in class')
          if (c === '!' && i === classStart + 1) c = '^'
          re += c
          continue
        }

        // if we already have a stateChar, then it means
        // that there was something like ** or +? in there.
        // Handle the stateChar, then proceed with this one.
        self.debug('call clearStateChar %j', stateChar)
        clearStateChar()
        stateChar = c
        // if extglob is disabled, then +(asdf|foo) isn't a thing.
        // just clear the statechar *now*, rather than even diving into
        // the patternList stuff.
        if (options.noext) clearStateChar()
      continue

      case '(':
        if (inClass) {
          re += '('
          continue
        }

        if (!stateChar) {
          re += '\\('
          continue
        }

        patternListStack.push({
          type: stateChar,
          start: i - 1,
          reStart: re.length,
          open: plTypes[stateChar].open,
          close: plTypes[stateChar].close
        })
        // negation is (?:(?!js)[^/]*)
        re += stateChar === '!' ? '(?:(?!(?:' : '(?:'
        this.debug('plType %j %j', stateChar, re)
        stateChar = false
      continue

      case ')':
        if (inClass || !patternListStack.length) {
          re += '\\)'
          continue
        }

        clearStateChar()
        hasMagic = true
        var pl = patternListStack.pop()
        // negation is (?:(?!js)[^/]*)
        // The others are (?:<pattern>)<type>
        re += pl.close
        if (pl.type === '!') {
          negativeLists.push(pl)
        }
        pl.reEnd = re.length
      continue

      case '|':
        if (inClass || !patternListStack.length || escaping) {
          re += '\\|'
          escaping = false
          continue
        }

        clearStateChar()
        re += '|'
      continue

      // these are mostly the same in regexp and glob
      case '[':
        // swallow any state-tracking char before the [
        clearStateChar()

        if (inClass) {
          re += '\\' + c
          continue
        }

        inClass = true
        classStart = i
        reClassStart = re.length
        re += c
      continue

      case ']':
        //  a right bracket shall lose its special
        //  meaning and represent itself in
        //  a bracket expression if it occurs
        //  first in the list.  -- POSIX.2 2.8.3.2
        if (i === classStart + 1 || !inClass) {
          re += '\\' + c
          escaping = false
          continue
        }

        // handle the case where we left a class open.
        // "[z-a]" is valid, equivalent to "\[z-a\]"
        // split where the last [ was, make sure we don't have
        // an invalid re. if so, re-walk the contents of the
        // would-be class to re-translate any characters that
        // were passed through as-is
        // TODO: It would probably be faster to determine this
        // without a try/catch and a new RegExp, but it's tricky
        // to do safely.  For now, this is safe and works.
        var cs = pattern.substring(classStart + 1, i)
        try {
          RegExp('[' + cs + ']')
        } catch (er) {
          // not a valid class!
          var sp = this.parse(cs, SUBPARSE)
          re = re.substr(0, reClassStart) + '\\[' + sp[0] + '\\]'
          hasMagic = hasMagic || sp[1]
          inClass = false
          continue
        }

        // finish up the class.
        hasMagic = true
        inClass = false
        re += c
      continue

      default:
        // swallow any state char that wasn't consumed
        clearStateChar()

        if (escaping) {
          // no need
          escaping = false
        } else if (reSpecials[c]
          && !(c === '^' && inClass)) {
          re += '\\'
        }

        re += c

    } // switch
  } // for

  // handle the case where we left a class open.
  // "[abc" is valid, equivalent to "\[abc"
  if (inClass) {
    // split where the last [ was, and escape it
    // this is a huge pita.  We now have to re-walk
    // the contents of the would-be class to re-translate
    // any characters that were passed through as-is
    cs = pattern.substr(classStart + 1)
    sp = this.parse(cs, SUBPARSE)
    re = re.substr(0, reClassStart) + '\\[' + sp[0]
    hasMagic = hasMagic || sp[1]
  }

  // handle the case where we had a +( thing at the *end*
  // of the pattern.
  // each pattern list stack adds 3 chars, and we need to go through
  // and escape any | chars that were passed through as-is for the regexp.
  // Go through and escape them, taking care not to double-escape any
  // | chars that were already escaped.
  for (pl = patternListStack.pop(); pl; pl = patternListStack.pop()) {
    var tail = re.slice(pl.reStart + pl.open.length)
    this.debug('setting tail', re, pl)
    // maybe some even number of \, then maybe 1 \, followed by a |
    tail = tail.replace(/((?:\\{2}){0,64})(\\?)\|/g, function (_, $1, $2) {
      if (!$2) {
        // the | isn't already escaped, so escape it.
        $2 = '\\'
      }

      // need to escape all those slashes *again*, without escaping the
      // one that we need for escaping the | character.  As it works out,
      // escaping an even number of slashes can be done by simply repeating
      // it exactly after itself.  That's why this trick works.
      //
      // I am sorry that you have to see this.
      return $1 + $1 + $2 + '|'
    })

    this.debug('tail=%j\n   %s', tail, tail, pl, re)
    var t = pl.type === '*' ? star
      : pl.type === '?' ? qmark
      : '\\' + pl.type

    hasMagic = true
    re = re.slice(0, pl.reStart) + t + '\\(' + tail
  }

  // handle trailing things that only matter at the very end.
  clearStateChar()
  if (escaping) {
    // trailing \\
    re += '\\\\'
  }

  // only need to apply the nodot start if the re starts with
  // something that could conceivably capture a dot
  var addPatternStart = false
  switch (re.charAt(0)) {
    case '[': case '.': case '(': addPatternStart = true
  }

  // Hack to work around lack of negative lookbehind in JS
  // A pattern like: *.!(x).!(y|z) needs to ensure that a name
  // like 'a.xyz.yz' doesn't match.  So, the first negative
  // lookahead, has to look ALL the way ahead, to the end of
  // the pattern.
  for (var n = negativeLists.length - 1; n > -1; n--) {
    var nl = negativeLists[n]

    var nlBefore = re.slice(0, nl.reStart)
    var nlFirst = re.slice(nl.reStart, nl.reEnd - 8)
    var nlLast = re.slice(nl.reEnd - 8, nl.reEnd)
    var nlAfter = re.slice(nl.reEnd)

    nlLast += nlAfter

    // Handle nested stuff like *(*.js|!(*.json)), where open parens
    // mean that we should *not* include the ) in the bit that is considered
    // "after" the negated section.
    var openParensBefore = nlBefore.split('(').length - 1
    var cleanAfter = nlAfter
    for (i = 0; i < openParensBefore; i++) {
      cleanAfter = cleanAfter.replace(/\)[+*?]?/, '')
    }
    nlAfter = cleanAfter

    var dollar = ''
    if (nlAfter === '' && isSub !== SUBPARSE) {
      dollar = '$'
    }
    var newRe = nlBefore + nlFirst + nlAfter + dollar + nlLast
    re = newRe
  }

  // if the re is not "" at this point, then we need to make sure
  // it doesn't match against an empty path part.
  // Otherwise a/* will match a/, which it should not.
  if (re !== '' && hasMagic) {
    re = '(?=.)' + re
  }

  if (addPatternStart) {
    re = patternStart + re
  }

  // parsing just a piece of a larger pattern.
  if (isSub === SUBPARSE) {
    return [re, hasMagic]
  }

  // skip the regexp for non-magical patterns
  // unescape anything in it, though, so that it'll be
  // an exact match against a file etc.
  if (!hasMagic) {
    return globUnescape(pattern)
  }

  var flags = options.nocase ? 'i' : ''
  try {
    var regExp = new RegExp('^' + re + '$', flags)
  } catch (er) /* istanbul ignore next - should be impossible */ {
    // If it was an invalid regular expression, then it can't match
    // anything.  This trick looks for a character after the end of
    // the string, which is of course impossible, except in multi-line
    // mode, but it's not a /m regex.
    return new RegExp('$.')
  }

  regExp._glob = pattern
  regExp._src = re

  return regExp
}

minimatch.makeRe = function (pattern, options) {
  return new Minimatch(pattern, options || {}).makeRe()
}

Minimatch.prototype.makeRe = makeRe
function makeRe () {
  if (this.regexp || this.regexp === false) return this.regexp

  // at this point, this.set is a 2d array of partial
  // pattern strings, or "**".
  //
  // It's better to use .match().  This function shouldn't
  // be used, really, but it's pretty convenient sometimes,
  // when you just want to work with a regex.
  var set = this.set

  if (!set.length) {
    this.regexp = false
    return this.regexp
  }
  var options = this.options

  var twoStar = options.noglobstar ? star
    : options.dot ? twoStarDot
    : twoStarNoDot
  var flags = options.nocase ? 'i' : ''

  var re = set.map(function (pattern) {
    return pattern.map(function (p) {
      return (p === GLOBSTAR) ? twoStar
      : (typeof p === 'string') ? regExpEscape(p)
      : p._src
    }).join('\\\/')
  }).join('|')

  // must match entire pattern
  // ending in a * or ** will make it less strict.
  re = '^(?:' + re + ')$'

  // can match anything, as long as it's not this.
  if (this.negate) re = '^(?!' + re + ').*$'

  try {
    this.regexp = new RegExp(re, flags)
  } catch (ex) /* istanbul ignore next - should be impossible */ {
    this.regexp = false
  }
  return this.regexp
}

minimatch.match = function (list, pattern, options) {
  options = options || {}
  var mm = new Minimatch(pattern, options)
  list = list.filter(function (f) {
    return mm.match(f)
  })
  if (mm.options.nonull && !list.length) {
    list.push(pattern)
  }
  return list
}

Minimatch.prototype.match = function match (f, partial) {
  if (typeof partial === 'undefined') partial = this.partial
  this.debug('match', f, this.pattern)
  // short-circuit in the case of busted things.
  // comments, etc.
  if (this.comment) return false
  if (this.empty) return f === ''

  if (f === '/' && partial) return true

  var options = this.options

  // windows: need to use /, not \
  if (path.sep !== '/') {
    f = f.split(path.sep).join('/')
  }

  // treat the test path as a set of pathparts.
  f = f.split(slashSplit)
  this.debug(this.pattern, 'split', f)

  // just ONE of the pattern sets in this.set needs to match
  // in order for it to be valid.  If negating, then just one
  // match means that we have failed.
  // Either way, return on the first hit.

  var set = this.set
  this.debug(this.pattern, 'set', set)

  // Find the basename of the path by looking for the last non-empty segment
  var filename
  var i
  for (i = f.length - 1; i >= 0; i--) {
    filename = f[i]
    if (filename) break
  }

  for (i = 0; i < set.length; i++) {
    var pattern = set[i]
    var file = f
    if (options.matchBase && pattern.length === 1) {
      file = [filename]
    }
    var hit = this.matchOne(file, pattern, partial)
    if (hit) {
      if (options.flipNegate) return true
      return !this.negate
    }
  }

  // didn't get any hits.  this is success if it's a negative
  // pattern, failure otherwise.
  if (options.flipNegate) return false
  return this.negate
}

// set partial to true to test if, for example,
// "/a/b" matches the start of "/*/b/*/d"
// Partial means, if you run out of file before you run
// out of pattern, then that's fine, as long as all
// the parts match.
Minimatch.prototype.matchOne = function (file, pattern, partial) {
  var options = this.options

  this.debug('matchOne',
    { 'this': this, file: file, pattern: pattern })

  this.debug('matchOne', file.length, pattern.length)

  for (var fi = 0,
      pi = 0,
      fl = file.length,
      pl = pattern.length
      ; (fi < fl) && (pi < pl)
      ; fi++, pi++) {
    this.debug('matchOne loop')
    var p = pattern[pi]
    var f = file[fi]

    this.debug(pattern, p, f)

    // should be impossible.
    // some invalid regexp stuff in the set.
    /* istanbul ignore if */
    if (p === false) return false

    if (p === GLOBSTAR) {
      this.debug('GLOBSTAR', [pattern, p, f])

      // "**"
      // a/**/b/**/c would match the following:
      // a/b/x/y/z/c
      // a/x/y/z/b/c
      // a/b/x/b/x/c
      // a/b/c
      // To do this, take the rest of the pattern after
      // the **, and see if it would match the file remainder.
      // If so, return success.
      // If not, the ** "swallows" a segment, and try again.
      // This is recursively awful.
      //
      // a/**/b/**/c matching a/b/x/y/z/c
      // - a matches a
      // - doublestar
      //   - matchOne(b/x/y/z/c, b/**/c)
      //     - b matches b
      //     - doublestar
      //       - matchOne(x/y/z/c, c) -> no
      //       - matchOne(y/z/c, c) -> no
      //       - matchOne(z/c, c) -> no
      //       - matchOne(c, c) yes, hit
      var fr = fi
      var pr = pi + 1
      if (pr === pl) {
        this.debug('** at the end')
        // a ** at the end will just swallow the rest.
        // We have found a match.
        // however, it will not swallow /.x, unless
        // options.dot is set.
        // . and .. are *never* matched by **, for explosively
        // exponential reasons.
        for (; fi < fl; fi++) {
          if (file[fi] === '.' || file[fi] === '..' ||
            (!options.dot && file[fi].charAt(0) === '.')) return false
        }
        return true
      }

      // ok, let's see if we can swallow whatever we can.
      while (fr < fl) {
        var swallowee = file[fr]

        this.debug('\nglobstar while', file, fr, pattern, pr, swallowee)

        // XXX remove this slice.  Just pass the start index.
        if (this.matchOne(file.slice(fr), pattern.slice(pr), partial)) {
          this.debug('globstar found match!', fr, fl, swallowee)
          // found a match.
          return true
        } else {
          // can't swallow "." or ".." ever.
          // can only swallow ".foo" when explicitly asked.
          if (swallowee === '.' || swallowee === '..' ||
            (!options.dot && swallowee.charAt(0) === '.')) {
            this.debug('dot detected!', file, fr, pattern, pr)
            break
          }

          // ** swallows a segment, and continue.
          this.debug('globstar swallow a segment, and continue')
          fr++
        }
      }

      // no match was found.
      // However, in partial mode, we can't say this is necessarily over.
      // If there's more *pattern* left, then
      /* istanbul ignore if */
      if (partial) {
        // ran out of file
        this.debug('\n>>> no match, partial?', file, fr, pattern, pr)
        if (fr === fl) return true
      }
      return false
    }

    // something other than **
    // non-magic patterns just have to match exactly
    // patterns with magic have been turned into regexps.
    var hit
    if (typeof p === 'string') {
      hit = f === p
      this.debug('string match', p, f, hit)
    } else {
      hit = f.match(p)
      this.debug('pattern match', p, f, hit)
    }

    if (!hit) return false
  }

  // Note: ending in / means that we'll get a final ""
  // at the end of the pattern.  This can only match a
  // corresponding "" at the end of the file.
  // If the file ends in /, then it can only match a
  // a pattern that ends in /, unless the pattern just
  // doesn't have any more for it. But, a/b/ should *not*
  // match "a/b/*", even though "" matches against the
  // [^/]*? pattern, except in partial mode, where it might
  // simply not be reached yet.
  // However, a/b/ should still satisfy a/*

  // now either we fell off the end of the pattern, or we're done.
  if (fi === fl && pi === pl) {
    // ran out of pattern and filename at the same time.
    // an exact hit!
    return true
  } else if (fi === fl) {
    // ran out of file, but still had pattern left.
    // this is ok if we're doing the match as part of
    // a glob fs traversal.
    return partial
  } else /* istanbul ignore else */ if (pi === pl) {
    // ran out of pattern, still have file left.
    // this is only acceptable if we're on the very last
    // empty segment of a file with a trailing slash.
    // a/* should match a/b/
    return (fi === fl - 1) && (file[fi] === '')
  }

  // should be unreachable.
  /* istanbul ignore next */
  throw new Error('wtf?')
}

// replace stuff like \* with *
function globUnescape (s) {
  return s.replace(/\\(.)/g, '$1')
}

function regExpEscape (s) {
  return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
}


/***/ }),

/***/ 890:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

"use strict";

const Queue = __nccwpck_require__(538);

const pLimit = concurrency => {
	if (!((Number.isInteger(concurrency) || concurrency === Infinity) && concurrency > 0)) {
		throw new TypeError('Expected `concurrency` to be a number from 1 and up');
	}

	const queue = new Queue();
	let activeCount = 0;

	const next = () => {
		activeCount--;

		if (queue.size > 0) {
			queue.dequeue()();
		}
	};

	const run = async (fn, resolve, ...args) => {
		activeCount++;

		const result = (async () => fn(...args))();

		resolve(result);

		try {
			await result;
		} catch {}

		next();
	};

	const enqueue = (fn, resolve, ...args) => {
		queue.enqueue(run.bind(null, fn, resolve, ...args));

		(async () => {
			// This function needs to wait until the next microtask before comparing
			// `activeCount` to `concurrency`, because `activeCount` is updated asynchronously
			// when the run function is dequeued and called. The comparison in the if-statement
			// needs to happen asynchronously as well to get an up-to-date value for `activeCount`.
			await Promise.resolve();

			if (activeCount < concurrency && queue.size > 0) {
				queue.dequeue()();
			}
		})();
	};

	const generator = (fn, ...args) => new Promise(resolve => {
		enqueue(fn, resolve, ...args);
	});

	Object.defineProperties(generator, {
		activeCount: {
			get: () => activeCount
		},
		pendingCount: {
			get: () => queue.size
		},
		clearQueue: {
			value: () => {
				queue.clear();
			}
		}
	});

	return generator;
};

module.exports = pLimit;


/***/ }),

/***/ 538:
/***/ ((module) => {

class Node {
	/// value;
	/// next;

	constructor(value) {
		this.value = value;

		// TODO: Remove this when targeting Node.js 12.
		this.next = undefined;
	}
}

class Queue {
	// TODO: Use private class fields when targeting Node.js 12.
	// #_head;
	// #_tail;
	// #_size;

	constructor() {
		this.clear();
	}

	enqueue(value) {
		const node = new Node(value);

		if (this._head) {
			this._tail.next = node;
			this._tail = node;
		} else {
			this._head = node;
			this._tail = node;
		}

		this._size++;
	}

	dequeue() {
		const current = this._head;
		if (!current) {
			return;
		}

		this._head = this._head.next;
		this._size--;
		return current.value;
	}

	clear() {
		this._head = undefined;
		this._tail = undefined;
		this._size = 0;
	}

	get size() {
		return this._size;
	}

	* [Symbol.iterator]() {
		let current = this._head;

		while (current) {
			yield current.value;
			current = current.next;
		}
	}
}

module.exports = Queue;


/***/ }),

/***/ 896:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ 928:
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ }),

/***/ 384:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EntryBuilder = void 0;
const fs_1 = __importDefault(__nccwpck_require__(896));
const path_1 = __importDefault(__nccwpck_require__(928));
const EntryComparator_1 = __nccwpck_require__(119);
const PATH_SEP = path_1.default.sep;
exports.EntryBuilder = {
    /**
     * Returns the sorted list of entries in a directory.
     */
    buildDirEntries(rootEntry, dirEntries, relativePath, origin, options) {
        const res = [];
        for (let i = 0; i < dirEntries.length; i++) {
            const entryName = dirEntries[i];
            const entryAbsolutePath = rootEntry.absolutePath + PATH_SEP + entryName;
            const entryPath = rootEntry.path + PATH_SEP + entryName;
            const entry = this.buildEntry(entryAbsolutePath, entryPath, entryName, origin, options);
            if (options.skipSymlinks && entry.isSymlink) {
                entry.stat = undefined;
            }
            if (filterEntry(entry, relativePath, options)) {
                res.push(entry);
            }
        }
        return res.sort((a, b) => EntryComparator_1.EntryComparator.compareEntry(a, b, options));
    },
    buildEntry(absolutePath, path, name, origin, options) {
        const stats = getStatIgnoreBrokenLink(absolutePath);
        const isDirectory = stats.stat.isDirectory();
        let isPermissionDenied = false;
        if (options.handlePermissionDenied) {
            const isFile = !isDirectory;
            isPermissionDenied = hasPermissionDenied(absolutePath, isFile, options);
        }
        return {
            name,
            absolutePath,
            path,
            origin,
            stat: stats.stat,
            lstat: stats.lstat,
            isSymlink: stats.lstat.isSymbolicLink(),
            isBrokenLink: stats.isBrokenLink,
            isDirectory,
            isPermissionDenied
        };
    },
};
function hasPermissionDenied(absolutePath, isFile, options) {
    if (isFile && !options.compareContent) {
        return false;
    }
    try {
        fs_1.default.accessSync(absolutePath, fs_1.default.constants.R_OK);
        return false;
    }
    catch (_a) {
        return true;
    }
}
function getStatIgnoreBrokenLink(absolutePath) {
    const lstat = fs_1.default.lstatSync(absolutePath);
    try {
        return {
            stat: fs_1.default.statSync(absolutePath),
            lstat: lstat,
            isBrokenLink: false
        };
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return {
                stat: lstat,
                lstat: lstat,
                isBrokenLink: true
            };
        }
        throw error;
    }
}
/**
 * Filter entries by name. Returns true if the entry is to be processed.
 */
function filterEntry(entry, relativePath, options) {
    if (entry.isSymlink && options.skipSymlinks) {
        return false;
    }
    if (options.skipEmptyDirs && entry.stat.isDirectory() && isEmptyDir(entry.absolutePath)) {
        return false;
    }
    return options.filterHandler(entry, relativePath, options);
}
function isEmptyDir(path) {
    return fs_1.default.readdirSync(path).length === 0;
}
//# sourceMappingURL=EntryBuilder.js.map

/***/ }),

/***/ 119:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EntryComparator = void 0;
/**
 * Determines order criteria for sorting entries in a directory.
 */
exports.EntryComparator = {
    compareEntry(a, b, options) {
        if (a.isBrokenLink && b.isBrokenLink) {
            return options.compareNameHandler(a.name, b.name, options);
        }
        else if (a.isBrokenLink) {
            return -1;
        }
        else if (b.isBrokenLink) {
            return 1;
        }
        else if (a.stat.isDirectory() && b.stat.isFile()) {
            return -1;
        }
        else if (a.stat.isFile() && b.stat.isDirectory()) {
            return 1;
        }
        else {
            return options.compareNameHandler(a.name, b.name, options);
        }
    }
};
//# sourceMappingURL=EntryComparator.js.map

/***/ }),

/***/ 775:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EntryEquality = void 0;
const fs_1 = __importDefault(__nccwpck_require__(896));
/**
 * Compares two entries with identical name and type.
 */
exports.EntryEquality = {
    isEntryEqualSync(entry1, entry2, type, options) {
        if (type === 'file') {
            return isFileEqualSync(entry1, entry2, options);
        }
        if (type === 'directory') {
            return isDirectoryEqual(entry1, entry2, options);
        }
        if (type === 'broken-link') {
            return isBrokenLinkEqual();
        }
        throw new Error('Unexpected type ' + type);
    },
    isEntryEqualAsync(entry1, entry2, type, asyncDiffSet, options) {
        if (type === 'file') {
            return isFileEqualAsync(entry1, entry2, type, asyncDiffSet, options);
        }
        if (type === 'directory') {
            return Object.assign({ isSync: true }, isDirectoryEqual(entry1, entry2, options));
        }
        if (type === 'broken-link') {
            return Object.assign({ isSync: true }, isBrokenLinkEqual());
        }
        throw new Error('Unexpected type ' + type);
    },
};
function isFileEqualSync(entry1, entry2, options) {
    if (options.compareSymlink && !isSymlinkEqual(entry1, entry2)) {
        return { same: false, reason: 'different-symlink' };
    }
    if (options.compareSize && entry1.stat.size !== entry2.stat.size) {
        return { same: false, reason: 'different-size' };
    }
    if (options.compareDate && !isDateEqual(entry1.stat.mtime, entry2.stat.mtime, options.dateTolerance)) {
        return { same: false, reason: 'different-date' };
    }
    if (options.compareContent && !options.compareFileSync(entry1.absolutePath, entry1.stat, entry2.absolutePath, entry2.stat, options)) {
        return { same: false, reason: 'different-content' };
    }
    return { same: true };
}
function isFileEqualAsync(entry1, entry2, type, asyncDiffSet, options) {
    if (options.compareSymlink && !isSymlinkEqual(entry1, entry2)) {
        return { isSync: true, same: false, reason: 'different-symlink' };
    }
    if (options.compareSize && entry1.stat.size !== entry2.stat.size) {
        return { isSync: true, same: false, reason: 'different-size' };
    }
    if (options.compareDate && !isDateEqual(entry1.stat.mtime, entry2.stat.mtime, options.dateTolerance)) {
        return { isSync: true, same: false, reason: 'different-date' };
    }
    if (options.compareContent) {
        let subDiffSet;
        if (!options.noDiffSet) {
            subDiffSet = [];
            asyncDiffSet.push(subDiffSet);
        }
        const samePromise = options.compareFileAsync(entry1.absolutePath, entry1.stat, entry2.absolutePath, entry2.stat, options)
            .then((comparisonResult) => {
            if (typeof (comparisonResult) !== "boolean") {
                return {
                    hasErrors: true,
                    error: comparisonResult
                };
            }
            const same = comparisonResult;
            const reason = same ? undefined : 'different-content';
            return {
                hasErrors: false,
                same, reason,
                context: {
                    entry1, entry2,
                    type1: type, type2: type,
                    asyncDiffSet: subDiffSet,
                }
            };
        })
            .catch((error) => ({
            hasErrors: true,
            error
        }));
        return { isSync: false, fileEqualityAsyncPromise: samePromise };
    }
    return { isSync: true, same: true };
}
function isDirectoryEqual(entry1, entry2, options) {
    if (options.compareSymlink && !isSymlinkEqual(entry1, entry2)) {
        return { same: false, reason: 'different-symlink' };
    }
    return { same: true, reason: undefined };
}
function isBrokenLinkEqual() {
    return { same: false, reason: 'broken-link' }; // broken links are never considered equal
}
/**
 * Compares two dates and returns true/false depending on tolerance (milliseconds).
 * Two dates are considered equal if the difference in milliseconds between them is less or equal than tolerance.
 */
function isDateEqual(date1, date2, tolerance) {
    return Math.abs(date1.getTime() - date2.getTime()) <= tolerance ? true : false;
}
/**
 * Compares two entries for symlink equality.
 */
function isSymlinkEqual(entry1, entry2) {
    if (!entry1.isSymlink && !entry2.isSymlink) {
        return true;
    }
    if (entry1.isSymlink && entry2.isSymlink && hasIdenticalLink(entry1.absolutePath, entry2.absolutePath)) {
        return true;
    }
    return false;
}
function hasIdenticalLink(path1, path2) {
    return fs_1.default.readlinkSync(path1) === fs_1.default.readlinkSync(path2);
}
//# sourceMappingURL=EntryEquality.js.map

/***/ }),

/***/ 195:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EntryType = void 0;
exports.EntryType = {
    /**
     * One of 'missing','file','directory','broken-link'
     */
    getType(entry) {
        if (!entry) {
            return 'missing';
        }
        if (entry.isBrokenLink) {
            return 'broken-link';
        }
        if (entry.isDirectory) {
            return 'directory';
        }
        return 'file';
    }
};
//# sourceMappingURL=EntryType.js.map

/***/ }),

/***/ 728:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.defaultFileCompare = void 0;
const fs_1 = __importDefault(__nccwpck_require__(896));
const FileDescriptorQueue_1 = __nccwpck_require__(644);
const BufferPool_1 = __nccwpck_require__(124);
const FileCloser_1 = __nccwpck_require__(544);
const FsPromise_1 = __nccwpck_require__(694);
const MAX_CONCURRENT_FILE_COMPARE = 8;
const BUF_SIZE = 1000000;
const fdQueue = new FileDescriptorQueue_1.FileDescriptorQueue(MAX_CONCURRENT_FILE_COMPARE * 2);
const asyncBufferPool = new BufferPool_1.BufferPool(BUF_SIZE, MAX_CONCURRENT_FILE_COMPARE); // fdQueue guarantees there will be no more than MAX_CONCURRENT_FILE_COMPARE async processes accessing the buffers concurrently
const syncBufferPool = new BufferPool_1.BufferPool(BUF_SIZE, 2);
exports.defaultFileCompare = {
    compareSync, compareAsync
};
/**
 * Compares two files by content.
 */
function compareSync(path1, stat1, path2, stat2, options) {
    let fd1;
    let fd2;
    if (stat1.size !== stat2.size) {
        return false;
    }
    const bufferPair = syncBufferPool.allocateBuffers();
    try {
        fd1 = fs_1.default.openSync(path1, 'r');
        fd2 = fs_1.default.openSync(path2, 'r');
        const buf1 = bufferPair.buf1;
        const buf2 = bufferPair.buf2;
        for (;;) {
            const size1 = fs_1.default.readSync(fd1, buf1, 0, BUF_SIZE, null);
            const size2 = fs_1.default.readSync(fd2, buf2, 0, BUF_SIZE, null);
            if (size1 !== size2) {
                return false;
            }
            else if (size1 === 0) {
                // End of file reached
                return true;
            }
            else if (!compareBuffers(buf1, buf2, size1)) {
                return false;
            }
        }
    }
    finally {
        FileCloser_1.FileCloser.closeFilesSync(fd1, fd2);
        syncBufferPool.freeBuffers(bufferPair);
    }
}
/**
 * Compares two files by content
 */
function compareAsync(path1, stat1, path2, stat2, options) {
    let fd1;
    let fd2;
    let bufferPair;
    if (stat1.size !== stat2.size) {
        return Promise.resolve(false);
    }
    if (stat1.size < BUF_SIZE && !options.forceAsyncContentCompare) {
        return Promise.resolve(compareSync(path1, stat1, path2, stat2, options));
    }
    return Promise.all([fdQueue.openPromise(path1, 'r'), fdQueue.openPromise(path2, 'r')])
        .then(fds => {
        bufferPair = asyncBufferPool.allocateBuffers();
        fd1 = fds[0];
        fd2 = fds[1];
        const buf1 = bufferPair.buf1;
        const buf2 = bufferPair.buf2;
        const compareAsyncInternal = () => {
            return Promise.all([
                FsPromise_1.FsPromise.read(fd1, buf1, 0, BUF_SIZE, null),
                FsPromise_1.FsPromise.read(fd2, buf2, 0, BUF_SIZE, null)
            ]).then((bufferSizes) => {
                const size1 = bufferSizes[0];
                const size2 = bufferSizes[1];
                if (size1 !== size2) {
                    return false;
                }
                else if (size1 === 0) {
                    // End of file reached
                    return true;
                }
                else if (!compareBuffers(buf1, buf2, size1)) {
                    return false;
                }
                else {
                    return compareAsyncInternal();
                }
            });
        };
        return compareAsyncInternal();
    })
        .then(
    // 'finally' polyfill for node 8 and below
    res => finalizeAsync(fd1, fd2, bufferPair).then(() => res), err => finalizeAsync(fd1, fd2, bufferPair).then(() => { throw err; }));
}
function compareBuffers(buf1, buf2, contentSize) {
    return buf1.slice(0, contentSize).equals(buf2.slice(0, contentSize));
}
function finalizeAsync(fd1, fd2, bufferPair) {
    if (bufferPair) {
        asyncBufferPool.freeBuffers(bufferPair);
    }
    return FileCloser_1.FileCloser.closeFilesAsync(fd1, fd2, fdQueue);
}
//# sourceMappingURL=defaultFileCompare.js.map

/***/ }),

/***/ 33:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.LineBasedCompareContext = void 0;
class LineBasedCompareContext {
    constructor(fd1, fd2, bufferPair) {
        /**
         * Part of a line that was split at buffer boundary in a previous read.
         * Will be prefixed to the next read.
         */
        this.rest = { rest1: '', rest2: '' };
        /**
         * Lines that remain unprocessed from a previous read.
         * Will be prefixed to the next read.
         */
        this.restLines = { restLines1: [], restLines2: [] };
        this.fd1 = fd1;
        this.fd2 = fd2;
        this.buffer = bufferPair;
    }
}
exports.LineBasedCompareContext = LineBasedCompareContext;
//# sourceMappingURL=LineBasedCompareContext.js.map

/***/ }),

/***/ 927:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.compareLineBatches = void 0;
const compareLines_1 = __nccwpck_require__(862);
/**
 * Compares two batches of lines.
 *
 * @param lineBatch1 Batch to compare.
 * @param lineBatch2 Batch to compare.
 * @param context Comparison context.
 * @param options Comparison options.
 */
function compareLineBatches(lineBatch1, lineBatch2, options) {
    const compareResult = (0, compareLines_1.compareLines)(lineBatch1.lines, lineBatch2.lines, options);
    if (!compareResult.isEqual) {
        return { batchIsEqual: false, reachedEof: false, restLines: emptyRestLines() };
    }
    const reachedEof = lineBatch1.reachedEof && lineBatch2.reachedEof;
    const hasMoreLinesToProcess = compareResult.restLines1.length > 0 || compareResult.restLines2.length > 0;
    if (reachedEof && hasMoreLinesToProcess) {
        return { batchIsEqual: false, reachedEof: true, restLines: emptyRestLines() };
    }
    if (reachedEof) {
        return { batchIsEqual: true, reachedEof: true, restLines: emptyRestLines() };
    }
    return { batchIsEqual: true, reachedEof: false,
        restLines: {
            restLines1: compareResult.restLines1,
            restLines2: compareResult.restLines2,
        }
    };
}
exports.compareLineBatches = compareLineBatches;
function emptyRestLines() {
    return {
        restLines1: [],
        restLines2: []
    };
}
//# sourceMappingURL=compareLineBatches.js.map

/***/ }),

/***/ 862:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.compareLines = void 0;
const TRIM_WHITE_SPACES_REGEXP = /^[ \f\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[ \f\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$/g;
const TRIM_LINE_ENDING_REGEXP = /\r\n|\n$/g;
const REMOVE_WHITE_SPACES_REGEXP = /[ \f\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/g;
function compareLines(lines1, lines2, options) {
    if (options.ignoreEmptyLines) {
        lines1 = removeEmptyLines(lines1);
        lines2 = removeEmptyLines(lines2);
    }
    const len = Math.min(lines1.length, lines2.length);
    let i = 0;
    for (; i < len; i++) {
        const isEqual = compareLine(options, lines1[i], lines2[i]);
        if (!isEqual) {
            return { isEqual: false, restLines1: [], restLines2: [] };
        }
    }
    return {
        isEqual: true,
        restLines1: lines1.slice(i),
        restLines2: lines2.slice(i)
    };
}
exports.compareLines = compareLines;
function compareLine(options, line1, line2) {
    if (options.ignoreLineEnding) {
        line1 = trimLineEnding(line1);
        line2 = trimLineEnding(line2);
    }
    if (options.ignoreWhiteSpaces) {
        line1 = trimSpaces(line1);
        line2 = trimSpaces(line2);
    }
    if (options.ignoreAllWhiteSpaces) {
        line1 = removeSpaces(line1);
        line2 = removeSpaces(line2);
    }
    return line1 === line2;
}
// Trims string like '   abc   \n' into 'abc\n'
function trimSpaces(s) {
    const { content, lineEnding } = separateEol(s);
    const trimmed = content.replace(TRIM_WHITE_SPACES_REGEXP, '');
    return trimmed + lineEnding;
}
function trimLineEnding(s) {
    return s.replace(TRIM_LINE_ENDING_REGEXP, '');
}
function removeSpaces(s) {
    return s.replace(REMOVE_WHITE_SPACES_REGEXP, '');
}
function removeEmptyLines(lines) {
    return lines.filter(line => !isEmptyLine(line));
}
function isEmptyLine(line) {
    return line === '\n' || line === '\r\n';
}
function separateEol(s) {
    const len = s.length;
    let lineEnding = '';
    let content = s;
    if (s[len - 1] === '\n') {
        if (s[len - 2] === '\r') {
            return {
                lineEnding: '\r\n',
                content: s.slice(0, len - 2)
            };
        }
        {
            lineEnding = '\n';
            content = s.slice(0, len - 1);
        }
    }
    return { content, lineEnding };
}
//# sourceMappingURL=compareLines.js.map

/***/ }),

/***/ 690:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.lineBasedCompareAsync = void 0;
const FileDescriptorQueue_1 = __nccwpck_require__(644);
const LineBasedCompareContext_1 = __nccwpck_require__(33);
const BufferPool_1 = __nccwpck_require__(124);
const compareLineBatches_1 = __nccwpck_require__(927);
const readBufferedLines_1 = __nccwpck_require__(472);
const FileCloser_1 = __nccwpck_require__(544);
const FsPromise_1 = __nccwpck_require__(694);
const BUF_SIZE = 100000;
const MAX_CONCURRENT_FILE_COMPARE = 8;
const fdQueue = new FileDescriptorQueue_1.FileDescriptorQueue(MAX_CONCURRENT_FILE_COMPARE * 2);
const bufferPool = new BufferPool_1.BufferPool(BUF_SIZE, MAX_CONCURRENT_FILE_COMPARE); // fdQueue guarantees there will be no more than MAX_CONCURRENT_FILE_COMPARE async processes accessing the buffers concurrently
const lineBasedCompareAsync = (path1, stat1, path2, stat2, options) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const bufferSize = Math.min(BUF_SIZE, (_a = options.lineBasedHandlerBufferSize) !== null && _a !== void 0 ? _a : Number.MAX_VALUE);
    let context;
    try {
        const fileDescriptors = yield Promise.all([fdQueue.openPromise(path1, 'r'), fdQueue.openPromise(path2, 'r')]);
        context = new LineBasedCompareContext_1.LineBasedCompareContext(fileDescriptors[0], fileDescriptors[1], bufferPool.allocateBuffers());
        for (;;) {
            const lineBatch1 = yield readLineBatchAsync(context.fd1, context.buffer.buf1, bufferSize, context.rest.rest1, context.restLines.restLines1);
            const lineBatch2 = yield readLineBatchAsync(context.fd2, context.buffer.buf2, bufferSize, context.rest.rest2, context.restLines.restLines2);
            context.rest.rest1 = lineBatch1.rest;
            context.rest.rest2 = lineBatch2.rest;
            const compareResult = (0, compareLineBatches_1.compareLineBatches)(lineBatch1, lineBatch2, options);
            if (!compareResult.batchIsEqual) {
                return false;
            }
            if (compareResult.reachedEof) {
                return compareResult.batchIsEqual;
            }
            context.restLines.restLines1 = compareResult.restLines.restLines1;
            context.restLines.restLines2 = compareResult.restLines.restLines2;
        }
    }
    finally {
        if (context) {
            bufferPool.freeBuffers(context.buffer);
            yield FileCloser_1.FileCloser.closeFilesAsync(context.fd1, context.fd2, fdQueue);
        }
    }
});
exports.lineBasedCompareAsync = lineBasedCompareAsync;
/**
 * Reads a batch of lines from file starting with current position.
 *
 * @param fd File to read lines from.
 * @param buf Buffer used as temporary line storage.
 * @param bufferSize Allocated buffer size. The number of lines in the batch is limited by this size.
 * @param rest Part of a line that was split at buffer boundary in a previous read.
 *             Will be added to result.
 * @param restLines Lines that remain unprocessed from a previous read.
 *             Will be added to result.
 */
function readLineBatchAsync(fd, buf, bufferSize, rest, restLines) {
    return __awaiter(this, void 0, void 0, function* () {
        const size = yield FsPromise_1.FsPromise.read(fd, buf, 0, bufferSize, null);
        return (0, readBufferedLines_1.readBufferedLines)(buf, size, bufferSize, rest, restLines);
    });
}
//# sourceMappingURL=lineBasedCompareAsync.js.map

/***/ }),

/***/ 727:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.lineBasedCompareSync = void 0;
const fs_1 = __importDefault(__nccwpck_require__(896));
const LineBasedCompareContext_1 = __nccwpck_require__(33);
const compareLineBatches_1 = __nccwpck_require__(927);
const readBufferedLines_1 = __nccwpck_require__(472);
const FileCloser_1 = __nccwpck_require__(544);
const BUF_SIZE = 100000;
const bufferPair = {
    buf1: Buffer.alloc(BUF_SIZE),
    buf2: Buffer.alloc(BUF_SIZE),
    busy: true
};
const lineBasedCompareSync = (path1, stat1, path2, stat2, options) => {
    var _a;
    const bufferSize = Math.min(BUF_SIZE, (_a = options.lineBasedHandlerBufferSize) !== null && _a !== void 0 ? _a : Number.MAX_VALUE);
    let context;
    try {
        context = new LineBasedCompareContext_1.LineBasedCompareContext(fs_1.default.openSync(path1, 'r'), fs_1.default.openSync(path2, 'r'), bufferPair);
        for (;;) {
            const lineBatch1 = readLineBatchSync(context.fd1, context.buffer.buf1, bufferSize, context.rest.rest1, context.restLines.restLines1);
            const lineBatch2 = readLineBatchSync(context.fd2, context.buffer.buf2, bufferSize, context.rest.rest2, context.restLines.restLines2);
            context.rest.rest1 = lineBatch1.rest;
            context.rest.rest2 = lineBatch2.rest;
            const compareResult = (0, compareLineBatches_1.compareLineBatches)(lineBatch1, lineBatch2, options);
            if (!compareResult.batchIsEqual) {
                return false;
            }
            if (compareResult.reachedEof) {
                return compareResult.batchIsEqual;
            }
            context.restLines.restLines1 = compareResult.restLines.restLines1;
            context.restLines.restLines2 = compareResult.restLines.restLines2;
        }
    }
    finally {
        FileCloser_1.FileCloser.closeFilesSync(context === null || context === void 0 ? void 0 : context.fd1, context === null || context === void 0 ? void 0 : context.fd2);
    }
};
exports.lineBasedCompareSync = lineBasedCompareSync;
/**
 * Reads a batch of lines from file starting with current position.
 *
 * @param fd File to read lines from.
 * @param buf Buffer used as temporary line storage.
 * @param bufferSize Allocated buffer size. The number of lines in the batch is limited by this size.
 * @param rest Part of a line that was split at buffer boundary in a previous read.
 *             Will be added to result.
 * @param restLines Lines that remain unprocessed from a previous read.
 *             Will be added to result.
 */
function readLineBatchSync(fd, buf, bufferSize, rest, restLines) {
    const size = fs_1.default.readSync(fd, buf, 0, bufferSize, null);
    return (0, readBufferedLines_1.readBufferedLines)(buf, size, bufferSize, rest, restLines);
}
//# sourceMappingURL=lineBasedCompareSync.js.map

/***/ }),

/***/ 238:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.lineBasedFileCompare = void 0;
const lineBasedCompareSync_1 = __nccwpck_require__(727);
const lineBasedCompareAsync_1 = __nccwpck_require__(690);
/**
 * Compare files line by line with options to ignore
 * line endings and white space differences.
 */
exports.lineBasedFileCompare = {
    compareSync: lineBasedCompareSync_1.lineBasedCompareSync,
    compareAsync: lineBasedCompareAsync_1.lineBasedCompareAsync
};
//# sourceMappingURL=lineBasedFileCompare.js.map

/***/ }),

/***/ 472:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.readBufferedLines = void 0;
const LINE_TOKENIZER_REGEXP = /[^\n]+\n?|\n/g;
/**
 * Reads lines from given buffer.
 * @param buf Buffer to read lines from.
 * @param size Size of data available in buffer.
 * @param allocatedBufferSize Maximum buffer storage.
 * @param rest Part of a line that was split at buffer boundary in a previous read.
 *             Will be added to result.
 * @param restLines Lines that remain unprocessed from a previous read due to unbalanced buffers.
 *             Will be added to result.
 */
function readBufferedLines(buf, size, allocatedBufferSize, rest, restLines) {
    if (size === 0 && rest.length === 0) {
        return { lines: [...restLines], rest: '', reachedEof: true };
    }
    if (size === 0) {
        return { lines: [...restLines, rest], rest: '', reachedEof: true };
    }
    const fileContent = rest + buf.toString('utf8', 0, size);
    const lines = [...restLines, ...fileContent.match(LINE_TOKENIZER_REGEXP)];
    const reachedEof = size < allocatedBufferSize;
    if (reachedEof) {
        return {
            lines, rest: '', reachedEof: true
        };
    }
    return removeLastLine(lines);
}
exports.readBufferedLines = readBufferedLines;
/**
 * Last line is usually incomplete because our buffer rarely matches exactly the end of a line.
 * So we remove it from the line batch.
 * The deleted line is returned as the 'rest' parameter and will be incorporate at the beginning
 * of next read operation.
 */
function removeLastLine(lines) {
    const lastLine = lines[lines.length - 1];
    return {
        lines: lines.slice(0, lines.length - 1),
        rest: lastLine,
        reachedEof: false
    };
}
//# sourceMappingURL=readBufferedLines.js.map

/***/ }),

/***/ 124:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BufferPool = void 0;
/**
 * Collection of buffers to be shared between async processes.
 * Avoids allocating buffers each time async process starts.
 */
class BufferPool {
    /**
     *
     * @param bufSize Size of each buffer.
     * @param bufNo Number of buffers. Caller has to make sure no more than bufNo async processes run simultaneously.
     */
    constructor(bufSize, bufNo) {
        this.bufSize = bufSize;
        this.bufNo = bufNo;
        this.bufferPool = [];
        for (let i = 0; i < this.bufNo; i++) {
            this.bufferPool.push({
                buf1: Buffer.alloc(this.bufSize),
                buf2: Buffer.alloc(this.bufSize),
                busy: false
            });
        }
    }
    allocateBuffers() {
        for (let j = 0; j < this.bufNo; j++) {
            const bufferPair = this.bufferPool[j];
            if (!bufferPair.busy) {
                bufferPair.busy = true;
                return bufferPair;
            }
        }
        throw new Error('Async buffer limit reached');
    }
    freeBuffers(bufferPair) {
        bufferPair.busy = false;
    }
}
exports.BufferPool = BufferPool;
//# sourceMappingURL=BufferPool.js.map

/***/ }),

/***/ 544:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FileCloser = void 0;
const fs_1 = __importDefault(__nccwpck_require__(896));
function closeFilesSync(fd1, fd2) {
    if (fd1) {
        fs_1.default.closeSync(fd1);
    }
    if (fd2) {
        fs_1.default.closeSync(fd2);
    }
}
function closeFilesAsync(fd1, fd2, fdQueue) {
    if (fd1 && fd2) {
        return fdQueue.closePromise(fd1).then(() => fdQueue.closePromise(fd2));
    }
    if (fd1) {
        return fdQueue.closePromise(fd1);
    }
    if (fd2) {
        return fdQueue.closePromise(fd2);
    }
    return Promise.resolve();
}
exports.FileCloser = {
    closeFilesSync,
    closeFilesAsync
};
//# sourceMappingURL=FileCloser.js.map

/***/ }),

/***/ 644:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FileDescriptorQueue = void 0;
const fs_1 = __importDefault(__nccwpck_require__(896));
const Queue_1 = __nccwpck_require__(685);
/**
 * Limits the number of concurrent file handlers.
 * Use it as a wrapper over fs.open() and fs.close().
 * Example:
 *  const fdQueue = new FileDescriptorQueue(8)
 *  fdQueue.open(path, flags, (err, fd) =>{
 *    ...
 *    fdQueue.close(fd, (err) =>{
 *      ...
 *    })
 *  })
 */
class FileDescriptorQueue {
    constructor(maxFilesNo) {
        this.maxFilesNo = maxFilesNo;
        this.activeCount = 0;
        this.pendingJobs = new Queue_1.Queue();
    }
    open(path, flags, callback) {
        this.pendingJobs.enqueue({
            path: path,
            flags: flags,
            callback: callback
        });
        this.process();
    }
    process() {
        if (this.pendingJobs.getLength() > 0 && this.activeCount < this.maxFilesNo) {
            const job = this.pendingJobs.dequeue();
            this.activeCount++;
            fs_1.default.open(job.path, job.flags, job.callback);
        }
    }
    close(fd, callback) {
        this.activeCount--;
        fs_1.default.close(fd, callback);
        this.process();
    }
    openPromise(path, flags) {
        return new Promise((resolve, reject) => {
            this.open(path, flags, (err, fd) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(fd);
                }
            });
        });
    }
    closePromise(fd) {
        return new Promise((resolve, reject) => {
            this.close(fd, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
}
exports.FileDescriptorQueue = FileDescriptorQueue;
//# sourceMappingURL=FileDescriptorQueue.js.map

/***/ }),

/***/ 694:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FsPromise = void 0;
const fs_1 = __importDefault(__nccwpck_require__(896));
exports.FsPromise = {
    readdir(path) {
        return new Promise((resolve, reject) => {
            fs_1.default.readdir(path, (err, files) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(files);
                }
            });
        });
    },
    read(fd, buffer, offset, length, position) {
        return new Promise((resolve, reject) => {
            fs_1.default.read(fd, buffer, offset, length, position, (err, bytesRead) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(bytesRead);
                }
            });
        });
    },
};
//# sourceMappingURL=FsPromise.js.map

/***/ }),

/***/ 685:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

/*

Queue.js

A function to represent a queue

Created by Kate Morley - http://code.iamkate.com/ - and released under the terms
of the CC0 1.0 Universal legal code:

http://creativecommons.org/publicdomain/zero/1.0/legalcode

*/
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Queue = void 0;
const MAX_UNUSED_ARRAY_SIZE = 10000;
/* Creates a new queue. A queue is a first-in-first-out (FIFO) data structure -
 * items are added to the end of the queue and removed from the front.
 */
class Queue {
    constructor() {
        // Initialize the queue and offset
        this.queue = [];
        this.offset = 0;
    }
    // Returns the length of the queue.
    getLength() {
        return this.queue.length - this.offset;
    }
    /* Enqueues the specified item. The parameter is:
     *
     * item - the item to enqueue
     */
    enqueue(item) {
        this.queue.push(item);
    }
    /* Dequeues an item and returns it. If the queue is empty, the value
     * 'undefined' is returned.
     */
    dequeue() {
        // if the queue is empty, return immediately
        if (this.queue.length === 0) {
            return undefined;
        }
        // store the item at the front of the queue
        const item = this.queue[this.offset];
        // increment the offset and remove the free space if necessary
        if (++this.offset > MAX_UNUSED_ARRAY_SIZE) {
            this.queue = this.queue.slice(this.offset);
            this.offset = 0;
        }
        // return the dequeued item
        return item;
    }
}
exports.Queue = Queue;
//# sourceMappingURL=Queue.js.map

/***/ }),

/***/ 32:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.defaultFilterHandler = void 0;
const path_1 = __importDefault(__nccwpck_require__(928));
const minimatch_1 = __importDefault(__nccwpck_require__(772));
/**
 * Default filter handler that uses minimatch to accept/ignore files based on includeFilter and excludeFilter options.
 */
const defaultFilterHandler = (entry, relativePath, options) => {
    const path = path_1.default.join(relativePath, entry.name);
    if ((entry.stat.isFile() && options.includeFilter) && (!match(path, options.includeFilter))) {
        return false;
    }
    if ((options.excludeFilter) && (match(path, options.excludeFilter))) {
        return false;
    }
    return true;
};
exports.defaultFilterHandler = defaultFilterHandler;
/**
 * Matches path by pattern.
 */
function match(path, pattern) {
    const patternArray = pattern.split(',');
    for (let i = 0; i < patternArray.length; i++) {
        const pat = patternArray[i];
        if ((0, minimatch_1.default)(path, pat, { dot: true, matchBase: true })) { //nocase
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=defaultFilterHandler.js.map

/***/ }),

/***/ 16:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.defaultNameCompare = void 0;
/**
 * The default implementation uses the 'strcmp' function for comparing file or directory names.
 */
const defaultNameCompare = (name1, name2, options) => {
    if (options.ignoreCase) {
        name1 = name1.toLowerCase();
        name2 = name2.toLowerCase();
    }
    return strcmp(name1, name2);
};
exports.defaultNameCompare = defaultNameCompare;
function strcmp(str1, str2) {
    return ((str1 === str2) ? 0 : ((str1 > str2) ? 1 : -1));
}
//# sourceMappingURL=defaultNameCompare.js.map

/***/ }),

/***/ 968:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fileBasedNameCompare = void 0;
/**
 * Name comparator used when dir-compare is called to compare two files by content.
 * In this case the file name is ignored (ie. comparing a1.txt and a2.txt
 * will return true if file contents are identical).
 */
function fileBasedNameCompare(name1, name2, options) {
    return 0;
}
exports.fileBasedNameCompare = fileBasedNameCompare;
//# sourceMappingURL=fileBasedNameCompare.js.map

/***/ }),

/***/ 819:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Permission = void 0;
exports.Permission = {
    getPermissionDeniedState(entry1, entry2) {
        if (entry1.isPermissionDenied && entry2.isPermissionDenied) {
            return "access-error-both";
        }
        else if (entry1.isPermissionDenied) {
            return "access-error-left";
        }
        else if (entry2.isPermissionDenied) {
            return "access-error-right";
        }
        else {
            return "access-ok";
        }
    },
    getPermissionDeniedStateWhenLeftMissing(entry2) {
        let permissionDeniedState = "access-ok";
        if (entry2.isPermissionDenied) {
            permissionDeniedState = "access-error-right";
        }
        return permissionDeniedState;
    },
    getPermissionDeniedStateWhenRightMissing(entry1) {
        let permissionDeniedState = "access-ok";
        if (entry1.isPermissionDenied) {
            permissionDeniedState = "access-error-left";
        }
        return permissionDeniedState;
    }
};
//# sourceMappingURL=Permission.js.map

/***/ }),

/***/ 547:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.defaultResultBuilderCallback = void 0;
const path_1 = __importDefault(__nccwpck_require__(928));
const EntryType_1 = __nccwpck_require__(195);
function defaultResultBuilderCallback(entry1, entry2, state, level, relativePath, options, statistics, diffSet, reason, permissionDeniedState) {
    if (options.noDiffSet) {
        return;
    }
    diffSet.push({
        path1: entry1 ? path_1.default.dirname(entry1.path) : undefined,
        path2: entry2 ? path_1.default.dirname(entry2.path) : undefined,
        relativePath: relativePath,
        name1: entry1 ? entry1.name : undefined,
        name2: entry2 ? entry2.name : undefined,
        state: state,
        permissionDeniedState,
        type1: EntryType_1.EntryType.getType(entry1),
        type2: EntryType_1.EntryType.getType(entry2),
        level: level,
        size1: entry1 ? entry1.stat.size : undefined,
        size2: entry2 ? entry2.stat.size : undefined,
        date1: entry1 ? entry1.stat.mtime : undefined,
        date2: entry2 ? entry2.stat.mtime : undefined,
        reason: reason
    });
}
exports.defaultResultBuilderCallback = defaultResultBuilderCallback;
//# sourceMappingURL=defaultResultBuilderCallback.js.map

/***/ }),

/***/ 603:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.StatisticsLifecycle = void 0;
/**
 * Controls creation/completion of global statistics object.
 */
exports.StatisticsLifecycle = {
    initStats(options) {
        let symlinkStatistics = undefined;
        if (options.compareSymlink) {
            symlinkStatistics = {
                distinctSymlinks: 0,
                equalSymlinks: 0,
                leftSymlinks: 0,
                rightSymlinks: 0,
                differencesSymlinks: 0,
                totalSymlinks: 0,
            };
        }
        const brokenLinksStatistics = {
            leftBrokenLinks: 0,
            rightBrokenLinks: 0,
            distinctBrokenLinks: 0,
            totalBrokenLinks: 0
        };
        const permissionDeniedStatistics = {
            leftPermissionDenied: 0,
            rightPermissionDenied: 0,
            distinctPermissionDenied: 0,
            totalPermissionDenied: 0
        };
        return {
            distinct: 0,
            equal: 0,
            left: 0,
            right: 0,
            distinctFiles: 0,
            equalFiles: 0,
            leftFiles: 0,
            rightFiles: 0,
            distinctDirs: 0,
            equalDirs: 0,
            leftDirs: 0,
            rightDirs: 0,
            brokenLinks: brokenLinksStatistics,
            symlinks: symlinkStatistics,
            permissionDenied: permissionDeniedStatistics,
        };
    },
    completeStatistics(initialStatistics, options) {
        const statistics = JSON.parse(JSON.stringify(initialStatistics));
        statistics.differences = statistics.distinct + statistics.left + statistics.right;
        statistics.differencesFiles = statistics.distinctFiles + statistics.leftFiles + statistics.rightFiles;
        statistics.differencesDirs = statistics.distinctDirs + statistics.leftDirs + statistics.rightDirs;
        statistics.total = statistics.equal + statistics.differences;
        statistics.totalFiles = statistics.equalFiles + statistics.differencesFiles;
        statistics.totalDirs = statistics.equalDirs + statistics.differencesDirs;
        const brokenLInksStats = statistics.brokenLinks;
        brokenLInksStats.totalBrokenLinks = brokenLInksStats.leftBrokenLinks + brokenLInksStats.rightBrokenLinks + brokenLInksStats.distinctBrokenLinks;
        const permissionDeniedStats = statistics.permissionDenied;
        permissionDeniedStats.totalPermissionDenied = permissionDeniedStats.leftPermissionDenied + permissionDeniedStats.rightPermissionDenied + permissionDeniedStats.distinctPermissionDenied;
        statistics.same = statistics.differences ? false : true;
        if (options.compareSymlink) {
            const symlinkStatistics = statistics.symlinks;
            symlinkStatistics.differencesSymlinks = symlinkStatistics.distinctSymlinks +
                symlinkStatistics.leftSymlinks + symlinkStatistics.rightSymlinks;
            symlinkStatistics.totalSymlinks = symlinkStatistics.differencesSymlinks + symlinkStatistics.equalSymlinks;
        }
        return statistics;
    }
};
//# sourceMappingURL=StatisticsLifecycle.js.map

/***/ }),

/***/ 562:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.StatisticsUpdate = void 0;
/**
 * Calculates comparison statistics.
 */
exports.StatisticsUpdate = {
    updateStatisticsBoth(entry1, entry2, same, reason, type, permissionDeniedState, statistics, options) {
        same ? statistics.equal++ : statistics.distinct++;
        if (type === 'file') {
            same ? statistics.equalFiles++ : statistics.distinctFiles++;
        }
        else if (type === 'directory') {
            same ? statistics.equalDirs++ : statistics.distinctDirs++;
        }
        else if (type === 'broken-link') {
            statistics.brokenLinks.distinctBrokenLinks++;
        }
        else {
            throw new Error('Unexpected type ' + type);
        }
        const isSymlink1 = entry1 ? entry1.isSymlink : false;
        const isSymlink2 = entry2 ? entry2.isSymlink : false;
        const isSymlink = isSymlink1 || isSymlink2;
        if (options.compareSymlink && isSymlink) {
            const symlinkStatistics = statistics.symlinks;
            if (reason === 'different-symlink') {
                symlinkStatistics.distinctSymlinks++;
            }
            else {
                symlinkStatistics.equalSymlinks++;
            }
        }
        if (permissionDeniedState === "access-error-left") {
            statistics.permissionDenied.leftPermissionDenied++;
        }
        else if (permissionDeniedState === "access-error-right") {
            statistics.permissionDenied.rightPermissionDenied++;
        }
        else if (permissionDeniedState === "access-error-both") {
            statistics.permissionDenied.distinctPermissionDenied++;
        }
    },
    updateStatisticsLeft(entry1, type, permissionDeniedState, statistics, options) {
        statistics.left++;
        if (type === 'file') {
            statistics.leftFiles++;
        }
        else if (type === 'directory') {
            statistics.leftDirs++;
        }
        else if (type === 'broken-link') {
            statistics.brokenLinks.leftBrokenLinks++;
        }
        else {
            throw new Error('Unexpected type ' + type);
        }
        if (options.compareSymlink && entry1.isSymlink) {
            const symlinkStatistics = statistics.symlinks;
            symlinkStatistics.leftSymlinks++;
        }
        if (permissionDeniedState === "access-error-left") {
            statistics.permissionDenied.leftPermissionDenied++;
        }
    },
    updateStatisticsRight(entry2, type, permissionDeniedState, statistics, options) {
        statistics.right++;
        if (type === 'file') {
            statistics.rightFiles++;
        }
        else if (type === 'directory') {
            statistics.rightDirs++;
        }
        else if (type === 'broken-link') {
            statistics.brokenLinks.rightBrokenLinks++;
        }
        else {
            throw new Error('Unexpected type ' + type);
        }
        if (options.compareSymlink && entry2.isSymlink) {
            const symlinkStatistics = statistics.symlinks;
            symlinkStatistics.rightSymlinks++;
        }
        if (permissionDeniedState === "access-error-right") {
            statistics.permissionDenied.rightPermissionDenied++;
        }
    },
};
//# sourceMappingURL=StatisticsUpdate.js.map

/***/ }),

/***/ 482:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.LoopDetector = void 0;
const fs_1 = __importDefault(__nccwpck_require__(896));
/**
 * Provides symlink loop detection to directory traversal algorithm.
 */
exports.LoopDetector = {
    detectLoop(entry, symlinkCache) {
        if (entry && entry.isSymlink) {
            const realPath = fs_1.default.realpathSync(entry.absolutePath);
            if (symlinkCache[realPath]) {
                return true;
            }
        }
        return false;
    },
    initSymlinkCache() {
        return {
            dir1: {},
            dir2: {}
        };
    },
    updateSymlinkCache(symlinkCache, rootEntry1, rootEntry2, loopDetected1, loopDetected2) {
        let symlinkCachePath1, symlinkCachePath2;
        if (rootEntry1 && !loopDetected1) {
            symlinkCachePath1 = rootEntry1.isSymlink ? fs_1.default.realpathSync(rootEntry1.absolutePath) : rootEntry1.absolutePath;
            symlinkCache.dir1[symlinkCachePath1] = true;
        }
        if (rootEntry2 && !loopDetected2) {
            symlinkCachePath2 = rootEntry2.isSymlink ? fs_1.default.realpathSync(rootEntry2.absolutePath) : rootEntry2.absolutePath;
            symlinkCache.dir2[symlinkCachePath2] = true;
        }
    },
    cloneSymlinkCache(symlinkCache) {
        return {
            dir1: shallowClone(symlinkCache.dir1),
            dir2: shallowClone(symlinkCache.dir2)
        };
    },
};
function shallowClone(obj) {
    const cloned = {};
    Object.keys(obj).forEach(key => {
        cloned[key] = obj[key];
    });
    return cloned;
}
//# sourceMappingURL=LoopDetector.js.map

/***/ }),

/***/ 979:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.compareAsync = void 0;
const path_1 = __importDefault(__nccwpck_require__(928));
const EntryEquality_1 = __nccwpck_require__(775);
const FsPromise_1 = __nccwpck_require__(694);
const EntryBuilder_1 = __nccwpck_require__(384);
const LoopDetector_1 = __nccwpck_require__(482);
const EntryComparator_1 = __nccwpck_require__(119);
const EntryType_1 = __nccwpck_require__(195);
const Permission_1 = __nccwpck_require__(819);
const StatisticsUpdate_1 = __nccwpck_require__(562);
const p_limit_1 = __importDefault(__nccwpck_require__(890));
/**
 * Limits concurrent promises.
 */
const CONCURRENCY = 2;
/**
 * Returns the sorted list of entries in a directory.
 */
function getEntries(rootEntry, relativePath, loopDetected, origin, options) {
    if (!rootEntry || loopDetected) {
        return Promise.resolve([]);
    }
    if (rootEntry.isDirectory) {
        if (rootEntry.isPermissionDenied) {
            return Promise.resolve([]);
        }
        return FsPromise_1.FsPromise.readdir(rootEntry.absolutePath)
            .then(entries => EntryBuilder_1.EntryBuilder.buildDirEntries(rootEntry, entries, relativePath, origin, options));
    }
    return Promise.resolve([rootEntry]);
}
/**
 * Compares two directories asynchronously.
 */
function compareAsync(rootEntry1, rootEntry2, level, relativePath, options, statistics, asyncDiffSet, symlinkCache) {
    const limit = (0, p_limit_1.default)(CONCURRENCY);
    const loopDetected1 = LoopDetector_1.LoopDetector.detectLoop(rootEntry1, symlinkCache.dir1);
    const loopDetected2 = LoopDetector_1.LoopDetector.detectLoop(rootEntry2, symlinkCache.dir2);
    LoopDetector_1.LoopDetector.updateSymlinkCache(symlinkCache, rootEntry1, rootEntry2, loopDetected1, loopDetected2);
    return Promise.all([getEntries(rootEntry1, relativePath, loopDetected1, 'left', options), getEntries(rootEntry2, relativePath, loopDetected2, 'right', options)])
        .then(entriesResult => {
        const entries1 = entriesResult[0];
        const entries2 = entriesResult[1];
        let i1 = 0, i2 = 0;
        const comparePromises = [];
        const fileEqualityAsyncPromises = [];
        while (i1 < entries1.length || i2 < entries2.length) {
            const entry1 = entries1[i1];
            const entry2 = entries2[i2];
            let type1, type2;
            // compare entry name (-1, 0, 1)
            let cmp;
            if (i1 < entries1.length && i2 < entries2.length) {
                cmp = EntryComparator_1.EntryComparator.compareEntry(entry1, entry2, options);
                type1 = EntryType_1.EntryType.getType(entry1);
                type2 = EntryType_1.EntryType.getType(entry2);
            }
            else if (i1 < entries1.length) {
                type1 = EntryType_1.EntryType.getType(entry1);
                type2 = EntryType_1.EntryType.getType(undefined);
                cmp = -1;
            }
            else {
                type1 = EntryType_1.EntryType.getType(undefined);
                type2 = EntryType_1.EntryType.getType(entry2);
                cmp = 1;
            }
            // process entry
            if (cmp === 0) {
                // Both left/right exist and have the same name and type
                const skipEntry = options.skipSubdirs && type1 === 'directory';
                if (!skipEntry) {
                    const permissionDeniedState = Permission_1.Permission.getPermissionDeniedState(entry1, entry2);
                    if (permissionDeniedState === "access-ok") {
                        const compareEntryRes = EntryEquality_1.EntryEquality.isEntryEqualAsync(entry1, entry2, type1, asyncDiffSet, options);
                        if (compareEntryRes.isSync) {
                            options.resultBuilder(entry1, entry2, compareEntryRes.same ? 'equal' : 'distinct', level, relativePath, options, statistics, asyncDiffSet, compareEntryRes.reason, permissionDeniedState);
                            StatisticsUpdate_1.StatisticsUpdate.updateStatisticsBoth(entry1, entry2, compareEntryRes.same, compareEntryRes.reason, type1, permissionDeniedState, statistics, options);
                        }
                        else {
                            fileEqualityAsyncPromises.push(compareEntryRes.fileEqualityAsyncPromise);
                        }
                    }
                    else {
                        const state = 'distinct';
                        const reason = "permission-denied";
                        const same = false;
                        options.resultBuilder(entry1, entry2, state, level, relativePath, options, statistics, asyncDiffSet, reason, permissionDeniedState);
                        StatisticsUpdate_1.StatisticsUpdate.updateStatisticsBoth(entry1, entry2, same, reason, type1, permissionDeniedState, statistics, options);
                    }
                    if (type1 === 'directory') {
                        const subDiffSet = [];
                        if (!options.noDiffSet) {
                            asyncDiffSet.push(subDiffSet);
                        }
                        const comparePromise = limit(() => compareAsync(entry1, entry2, level + 1, path_1.default.join(relativePath, entry1.name), options, statistics, subDiffSet, LoopDetector_1.LoopDetector.cloneSymlinkCache(symlinkCache)));
                        comparePromises.push(comparePromise);
                    }
                }
                i1++;
                i2++;
            }
            else if (cmp < 0) {
                // Right missing
                const skipEntry = options.skipSubdirs && type1 === 'directory';
                if (!skipEntry) {
                    const permissionDeniedState = Permission_1.Permission.getPermissionDeniedStateWhenRightMissing(entry1);
                    options.resultBuilder(entry1, undefined, 'left', level, relativePath, options, statistics, asyncDiffSet, undefined, permissionDeniedState);
                    StatisticsUpdate_1.StatisticsUpdate.updateStatisticsLeft(entry1, type1, permissionDeniedState, statistics, options);
                    if (type1 === 'directory') {
                        const subDiffSet = [];
                        if (!options.noDiffSet) {
                            asyncDiffSet.push(subDiffSet);
                        }
                        const comparePromise = limit(() => compareAsync(entry1, undefined, level + 1, path_1.default.join(relativePath, entry1.name), options, statistics, subDiffSet, LoopDetector_1.LoopDetector.cloneSymlinkCache(symlinkCache)));
                        comparePromises.push(comparePromise);
                    }
                }
                i1++;
            }
            else {
                // Left missing
                const skipEntry = options.skipSubdirs && type2 === 'directory';
                if (!skipEntry) {
                    const permissionDeniedState = Permission_1.Permission.getPermissionDeniedStateWhenLeftMissing(entry2);
                    options.resultBuilder(undefined, entry2, 'right', level, relativePath, options, statistics, asyncDiffSet, undefined, permissionDeniedState);
                    StatisticsUpdate_1.StatisticsUpdate.updateStatisticsRight(entry2, type2, permissionDeniedState, statistics, options);
                    if (type2 === 'directory') {
                        const subDiffSet = [];
                        if (!options.noDiffSet) {
                            asyncDiffSet.push(subDiffSet);
                        }
                        const comparePromise = limit(() => compareAsync(undefined, entry2, level + 1, path_1.default.join(relativePath, entry2.name), options, statistics, subDiffSet, LoopDetector_1.LoopDetector.cloneSymlinkCache(symlinkCache)));
                        comparePromises.push(comparePromise);
                    }
                }
                i2++;
            }
        }
        return Promise.all(comparePromises)
            .then(() => Promise.all(fileEqualityAsyncPromises)
            .then(fileEqualityAsyncResults => {
            for (let i = 0; i < fileEqualityAsyncResults.length; i++) {
                const fileEqualityAsync = fileEqualityAsyncResults[i];
                if (fileEqualityAsync.hasErrors) {
                    return Promise.reject(fileEqualityAsync.error);
                }
                const permissionDeniedState = "access-ok";
                options.resultBuilder(fileEqualityAsync.context.entry1, fileEqualityAsync.context.entry2, fileEqualityAsync.same ? 'equal' : 'distinct', level, relativePath, options, statistics, fileEqualityAsync.context.asyncDiffSet, fileEqualityAsync.reason, permissionDeniedState);
                StatisticsUpdate_1.StatisticsUpdate.updateStatisticsBoth(fileEqualityAsync.context.entry1, fileEqualityAsync.context.entry2, fileEqualityAsync.same, fileEqualityAsync.reason, fileEqualityAsync.context.type1, permissionDeniedState, statistics, options);
            }
        }));
    });
}
exports.compareAsync = compareAsync;
//# sourceMappingURL=compareAsync.js.map

/***/ }),

/***/ 464:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.compareSync = void 0;
const fs_1 = __importDefault(__nccwpck_require__(896));
const path_1 = __importDefault(__nccwpck_require__(928));
const EntryEquality_1 = __nccwpck_require__(775);
const EntryBuilder_1 = __nccwpck_require__(384);
const LoopDetector_1 = __nccwpck_require__(482);
const EntryComparator_1 = __nccwpck_require__(119);
const EntryType_1 = __nccwpck_require__(195);
const Permission_1 = __nccwpck_require__(819);
const StatisticsUpdate_1 = __nccwpck_require__(562);
/**
 * Returns the sorted list of entries in a directory.
 */
function getEntries(rootEntry, relativePath, loopDetected, origin, options) {
    if (!rootEntry || loopDetected) {
        return [];
    }
    if (rootEntry.isDirectory) {
        if (rootEntry.isPermissionDenied) {
            return [];
        }
        const entries = fs_1.default.readdirSync(rootEntry.absolutePath);
        return EntryBuilder_1.EntryBuilder.buildDirEntries(rootEntry, entries, relativePath, origin, options);
    }
    return [rootEntry];
}
/**
 * Compares two directories synchronously.
 */
function compareSync(rootEntry1, rootEntry2, level, relativePath, options, statistics, diffSet, symlinkCache) {
    const loopDetected1 = LoopDetector_1.LoopDetector.detectLoop(rootEntry1, symlinkCache.dir1);
    const loopDetected2 = LoopDetector_1.LoopDetector.detectLoop(rootEntry2, symlinkCache.dir2);
    LoopDetector_1.LoopDetector.updateSymlinkCache(symlinkCache, rootEntry1, rootEntry2, loopDetected1, loopDetected2);
    const entries1 = getEntries(rootEntry1, relativePath, loopDetected1, 'left', options);
    const entries2 = getEntries(rootEntry2, relativePath, loopDetected2, 'right', options);
    let i1 = 0, i2 = 0;
    while (i1 < entries1.length || i2 < entries2.length) {
        const entry1 = entries1[i1];
        const entry2 = entries2[i2];
        let type1, type2;
        // compare entry name (-1, 0, 1)
        let cmp;
        if (i1 < entries1.length && i2 < entries2.length) {
            cmp = EntryComparator_1.EntryComparator.compareEntry(entry1, entry2, options);
            type1 = EntryType_1.EntryType.getType(entry1);
            type2 = EntryType_1.EntryType.getType(entry2);
        }
        else if (i1 < entries1.length) {
            type1 = EntryType_1.EntryType.getType(entry1);
            type2 = EntryType_1.EntryType.getType(undefined);
            cmp = -1;
        }
        else {
            type1 = EntryType_1.EntryType.getType(undefined);
            type2 = EntryType_1.EntryType.getType(entry2);
            cmp = 1;
        }
        // process entry
        if (cmp === 0) {
            // Both left/right exist and have the same name and type
            const skipEntry = options.skipSubdirs && type1 === 'directory';
            if (!skipEntry) {
                let same, reason, state;
                const permissionDeniedState = Permission_1.Permission.getPermissionDeniedState(entry1, entry2);
                if (permissionDeniedState === "access-ok") {
                    const compareEntryRes = EntryEquality_1.EntryEquality.isEntryEqualSync(entry1, entry2, type1, options);
                    state = compareEntryRes.same ? 'equal' : 'distinct';
                    same = compareEntryRes.same;
                    reason = compareEntryRes.reason;
                }
                else {
                    state = 'distinct';
                    same = false;
                    reason = "permission-denied";
                }
                options.resultBuilder(entry1, entry2, state, level, relativePath, options, statistics, diffSet, reason, permissionDeniedState);
                StatisticsUpdate_1.StatisticsUpdate.updateStatisticsBoth(entry1, entry2, same, reason, type1, permissionDeniedState, statistics, options);
                if (type1 === 'directory') {
                    compareSync(entry1, entry2, level + 1, path_1.default.join(relativePath, entry1.name), options, statistics, diffSet, LoopDetector_1.LoopDetector.cloneSymlinkCache(symlinkCache));
                }
            }
            i1++;
            i2++;
        }
        else if (cmp < 0) {
            // Right missing
            const skipEntry = options.skipSubdirs && type1 === 'directory';
            if (!skipEntry) {
                const permissionDeniedState = Permission_1.Permission.getPermissionDeniedStateWhenRightMissing(entry1);
                options.resultBuilder(entry1, undefined, 'left', level, relativePath, options, statistics, diffSet, undefined, permissionDeniedState);
                StatisticsUpdate_1.StatisticsUpdate.updateStatisticsLeft(entry1, type1, permissionDeniedState, statistics, options);
                if (type1 === 'directory') {
                    compareSync(entry1, undefined, level + 1, path_1.default.join(relativePath, entry1.name), options, statistics, diffSet, LoopDetector_1.LoopDetector.cloneSymlinkCache(symlinkCache));
                }
            }
            i1++;
        }
        else {
            // Left missing
            const skipEntry = options.skipSubdirs && type2 === 'directory';
            if (!skipEntry) {
                const permissionDeniedState = Permission_1.Permission.getPermissionDeniedStateWhenLeftMissing(entry2);
                options.resultBuilder(undefined, entry2, "right", level, relativePath, options, statistics, diffSet, undefined, permissionDeniedState);
                StatisticsUpdate_1.StatisticsUpdate.updateStatisticsRight(entry2, type2, permissionDeniedState, statistics, options);
                if (type2 === 'directory') {
                    compareSync(undefined, entry2, level + 1, path_1.default.join(relativePath, entry2.name), options, statistics, diffSet, LoopDetector_1.LoopDetector.cloneSymlinkCache(symlinkCache));
                }
            }
            i2++;
        }
    }
}
exports.compareSync = compareSync;
//# sourceMappingURL=compareSync.js.map

/***/ }),

/***/ 916:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.filterHandlers = exports.compareNameHandlers = exports.fileCompareHandlers = exports.compare = exports.compareSync = void 0;
const path_1 = __importDefault(__nccwpck_require__(928));
const fs_1 = __importDefault(__nccwpck_require__(896));
const compareSync_1 = __nccwpck_require__(464);
const compareAsync_1 = __nccwpck_require__(979);
const defaultFileCompare_1 = __nccwpck_require__(728);
const lineBasedFileCompare_1 = __nccwpck_require__(238);
const defaultNameCompare_1 = __nccwpck_require__(16);
const EntryBuilder_1 = __nccwpck_require__(384);
const StatisticsLifecycle_1 = __nccwpck_require__(603);
const LoopDetector_1 = __nccwpck_require__(482);
const defaultResultBuilderCallback_1 = __nccwpck_require__(547);
const fileBasedNameCompare_1 = __nccwpck_require__(968);
const defaultFilterHandler_1 = __nccwpck_require__(32);
const ROOT_PATH = path_1.default.sep;
__exportStar(__nccwpck_require__(409), exports);
/**
 * Synchronously compares given paths.
 * @param path1 Left file or directory to be compared.
 * @param path2 Right file or directory to be compared.
 * @param options Comparison options.
 */
function compareSync(path1, path2, options) {
    // realpathSync() is necessary for loop detection to work properly
    const absolutePath1 = path_1.default.normalize(path_1.default.resolve(fs_1.default.realpathSync(path1)));
    const absolutePath2 = path_1.default.normalize(path_1.default.resolve(fs_1.default.realpathSync(path2)));
    const compareInfo = getCompareInfo(absolutePath1, absolutePath2);
    const extOptions = prepareOptions(compareInfo, options);
    let diffSet;
    if (!extOptions.noDiffSet) {
        diffSet = [];
    }
    const initialStatistics = StatisticsLifecycle_1.StatisticsLifecycle.initStats(extOptions);
    if (compareInfo.mode === 'mixed') {
        compareMixedEntries(absolutePath1, absolutePath2, diffSet, initialStatistics, compareInfo);
    }
    else {
        (0, compareSync_1.compareSync)(EntryBuilder_1.EntryBuilder.buildEntry(absolutePath1, path1, path_1.default.basename(absolutePath1), 'left', extOptions), EntryBuilder_1.EntryBuilder.buildEntry(absolutePath2, path2, path_1.default.basename(absolutePath2), 'right', extOptions), 0, ROOT_PATH, extOptions, initialStatistics, diffSet, LoopDetector_1.LoopDetector.initSymlinkCache());
    }
    const result = StatisticsLifecycle_1.StatisticsLifecycle.completeStatistics(initialStatistics, extOptions);
    result.diffSet = diffSet;
    return result;
}
exports.compareSync = compareSync;
/**
 * Asynchronously compares given paths.
 * @param path1 Left file or directory to be compared.
 * @param path2 Right file or directory to be compared.
 * @param extOptions Comparison options.
 */
function compare(path1, path2, options) {
    let absolutePath1, absolutePath2;
    return Promise.resolve()
        .then(() => Promise.all([wrapper.realPath(path1), wrapper.realPath(path2)]))
        .then(realPaths => {
        const realPath1 = realPaths[0];
        const realPath2 = realPaths[1];
        // realpath() is necessary for loop detection to work properly
        absolutePath1 = path_1.default.normalize(path_1.default.resolve(realPath1));
        absolutePath2 = path_1.default.normalize(path_1.default.resolve(realPath2));
    })
        .then(() => {
        const compareInfo = getCompareInfo(absolutePath1, absolutePath2);
        const extOptions = prepareOptions(compareInfo, options);
        const asyncDiffSet = [];
        const initialStatistics = StatisticsLifecycle_1.StatisticsLifecycle.initStats(extOptions);
        if (compareInfo.mode === 'mixed') {
            let diffSet;
            if (!extOptions.noDiffSet) {
                diffSet = [];
            }
            compareMixedEntries(absolutePath1, absolutePath2, diffSet, initialStatistics, compareInfo);
            const result = StatisticsLifecycle_1.StatisticsLifecycle.completeStatistics(initialStatistics, extOptions);
            result.diffSet = diffSet;
            return result;
        }
        return (0, compareAsync_1.compareAsync)(EntryBuilder_1.EntryBuilder.buildEntry(absolutePath1, path1, path_1.default.basename(absolutePath1), 'left', extOptions), EntryBuilder_1.EntryBuilder.buildEntry(absolutePath2, path2, path_1.default.basename(absolutePath2), 'right', extOptions), 0, ROOT_PATH, extOptions, initialStatistics, asyncDiffSet, LoopDetector_1.LoopDetector.initSymlinkCache())
            .then(() => {
            const result = StatisticsLifecycle_1.StatisticsLifecycle.completeStatistics(initialStatistics, extOptions);
            if (!extOptions.noDiffSet) {
                const diffSet = [];
                rebuildAsyncDiffSet(result, asyncDiffSet, diffSet);
                result.diffSet = diffSet;
            }
            return result;
        });
    });
}
exports.compare = compare;
/**
 * List of {@link CompareFileHandler}s included with dir-compare.
 *
 * See [File content comparators](https://github.com/gliviu/dir-compare#file-content-comparators) for details.
 */
exports.fileCompareHandlers = {
    defaultFileCompare: defaultFileCompare_1.defaultFileCompare,
    lineBasedFileCompare: lineBasedFileCompare_1.lineBasedFileCompare
};
/**
 * List of {@link CompareNameHandler}s included with dir-compare.
 *
 * See [Name comparators](https://github.com/gliviu/dir-compare#name-comparators) for details.
 */
exports.compareNameHandlers = {
    defaultNameCompare: defaultNameCompare_1.defaultNameCompare
};
/**
 * List of {@link FilterHandler}s included with dir-compare.
 *
 * See [Glob filter](https://github.com/gliviu/dir-compare#glob-filter) for details.
 */
exports.filterHandlers = {
    defaultFilterHandler: defaultFilterHandler_1.defaultFilterHandler
};
const wrapper = {
    realPath(path, options) {
        return new Promise((resolve, reject) => {
            fs_1.default.realpath(path, options, (err, resolvedPath) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(resolvedPath);
                }
            });
        });
    }
};
function prepareOptions(compareInfo, options) {
    options = options || {};
    const clone = JSON.parse(JSON.stringify(options));
    clone.resultBuilder = options.resultBuilder;
    clone.compareFileSync = options.compareFileSync;
    clone.compareFileAsync = options.compareFileAsync;
    clone.compareNameHandler = options.compareNameHandler;
    clone.filterHandler = options.filterHandler;
    if (!clone.resultBuilder) {
        clone.resultBuilder = defaultResultBuilderCallback_1.defaultResultBuilderCallback;
    }
    if (!clone.compareFileSync) {
        clone.compareFileSync = defaultFileCompare_1.defaultFileCompare.compareSync;
    }
    if (!clone.compareFileAsync) {
        clone.compareFileAsync = defaultFileCompare_1.defaultFileCompare.compareAsync;
    }
    if (!clone.compareNameHandler) {
        const isFileBasedCompare = compareInfo.mode === 'files';
        clone.compareNameHandler = isFileBasedCompare ? fileBasedNameCompare_1.fileBasedNameCompare : defaultNameCompare_1.defaultNameCompare;
    }
    if (!clone.filterHandler) {
        clone.filterHandler = defaultFilterHandler_1.defaultFilterHandler;
    }
    clone.dateTolerance = clone.dateTolerance || 1000;
    clone.dateTolerance = Number(clone.dateTolerance);
    if (isNaN(clone.dateTolerance)) {
        throw new Error('Date tolerance is not a number');
    }
    return clone;
}
// Async DiffSets are kept into recursive structures.
// This method transforms them into one dimensional arrays.
function rebuildAsyncDiffSet(statistics, asyncDiffSet, diffSet) {
    asyncDiffSet.forEach(rawDiff => {
        if (!Array.isArray(rawDiff)) {
            diffSet.push(rawDiff);
        }
        else {
            rebuildAsyncDiffSet(statistics, rawDiff, diffSet);
        }
    });
}
function getCompareInfo(path1, path2) {
    const stat1 = fs_1.default.lstatSync(path1);
    const stat2 = fs_1.default.lstatSync(path2);
    if (stat1.isDirectory() && stat2.isDirectory()) {
        return {
            mode: 'directories',
            type1: 'directory',
            type2: 'directory',
            size1: stat1.size,
            size2: stat2.size,
            date1: stat1.mtime,
            date2: stat2.mtime,
        };
    }
    if (stat1.isFile() && stat2.isFile()) {
        return {
            mode: 'files',
            type1: 'file',
            type2: 'file',
            size1: stat1.size,
            size2: stat2.size,
            date1: stat1.mtime,
            date2: stat2.mtime,
        };
    }
    return {
        mode: 'mixed',
        type1: stat1.isFile() ? 'file' : 'directory',
        type2: stat2.isFile() ? 'file' : 'directory',
        size1: stat1.size,
        size2: stat2.size,
        date1: stat1.mtime,
        date2: stat2.mtime,
    };
}
/**
 * Normally dir-compare is used to compare either two directories or two files.
 * This method is used when one directory is compared to a file.
 */
function compareMixedEntries(path1, path2, diffSet, initialStatistics, compareInfo) {
    initialStatistics.distinct = 2;
    initialStatistics.distinctDirs = 1;
    initialStatistics.distinctFiles = 1;
    if (diffSet) {
        diffSet.push({
            path1,
            path2,
            relativePath: '',
            name1: path_1.default.basename(path1),
            name2: path_1.default.basename(path2),
            state: 'distinct',
            permissionDeniedState: 'access-ok',
            type1: compareInfo.type1,
            type2: compareInfo.type2,
            level: 0,
            size1: compareInfo.size1,
            size2: compareInfo.size2,
            date1: compareInfo.date1,
            date2: compareInfo.date2,
            reason: 'different-content',
        });
    }
}
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 409:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

/// <reference types="node" />
Object.defineProperty(exports, "__esModule", ({ value: true }));
//# sourceMappingURL=types.js.map

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";

// EXTERNAL MODULE: ./node_modules/dir-compare/build/src/index.js
var src = __nccwpck_require__(916);
;// CONCATENATED MODULE: external "node:fs"
const external_node_fs_namespaceObject = require("node:fs");
;// CONCATENATED MODULE: external "node:path"
const external_node_path_namespaceObject = require("node:path");
;// CONCATENATED MODULE: ./src/comparer-dossiers.ts



function processResult(res) {
    const resWithoutDiffSet = Object.assign({}, res);
    delete resWithoutDiffSet.diffSet;
    console.log(resWithoutDiffSet);
    // Suppression des fichiers déjà sauvegardés
    const allFilesPaths = new Set();
    for (const diff of res.diffSet) {
        if (diff.type1 === 'file' && diff.state === 'equal') {
            const fullPath1 = external_node_path_namespaceObject.join(diff.path1, diff.name1);
            deleteFile('Fichier', fullPath1);
        }
        if (diff.path1) {
            allFilesPaths.add(diff.path1);
        }
    }
    // Dossiers triés par longueur de chemin décroissant
    const allFilesPathsSorted = [];
    for (const path of allFilesPaths) {
        allFilesPathsSorted.push(path);
    }
    allFilesPathsSorted.sort((path1, path2) => path2.length - path1.length);
    // Suppression des dossiers vides
    for (const filePath of allFilesPathsSorted) {
        const files = external_node_fs_namespaceObject.readdirSync(filePath);
        if (files.includes('@eaDir')) {
            const eaDirPath = external_node_path_namespaceObject.join(filePath, '@eaDir');
            deleteFile('Dossier', eaDirPath, true);
        }
        const remainingFiles = files.filter(path => path !== '@eaDir');
        if (remainingFiles.length === 0) {
            deleteFile('Dossier', filePath);
        }
    }
}
function deleteFile(type, fullPath, recursive = false) {
    try {
        if (type === 'Dossier') {
            if (recursive) {
                if (!fullPath || fullPath === '/') {
                    console.error(`On évite de supprimer la racine !`);
                    return false;
                }
                const fileNames = external_node_fs_namespaceObject.readdirSync(fullPath);
                for (const fileName of fileNames) {
                    const filePath = external_node_path_namespaceObject.join(fullPath, fileName);
                    deleteFile(external_node_fs_namespaceObject.lstatSync(filePath).isDirectory() ? 'Dossier' : 'Fichier', filePath, true);
                }
            }
            external_node_fs_namespaceObject.rmdirSync(fullPath);
        }
        else {
            external_node_fs_namespaceObject.unlinkSync(fullPath);
        }
    }
    catch (e) {
        console.error(`${type} non supprimé à cause d'une erreur : ${fullPath}`, e);
        return false;
    }
    console.log(`${type} supprimé : ${fullPath}`);
    return true;
}
(function main(argv) {
    const args = argv.slice(2);
    if (args.length !== 2) {
        throw new Error(`Utilisation : <dossier à vérifier> <dossier déjà sauvegardé>`);
    }
    /** Dossier pouvant contenir des fichiers non sauvegardés */
    const path1 = args[0];
    /** Dossier contenant les fichiers déjà sauvegardés */
    const path2 = args[1];
    const options = {
        compareSize: false,
        compareContent: false,
    };
    (0,src.compare)(path1, path2, options)
        .then(res => processResult(res))
        .catch(error => console.error(error));
})(process.argv);

})();

module.exports = __webpack_exports__;
/******/ })()
;