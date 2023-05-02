/** @format */

const _toString = Object.prototype.toString;
const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: () => {},
  set: () => {},
};
const arrayProto = Array.prototype;
const arrayMethods = Object.create(arrayProto);
const arrayKeys = Object.getOwnPropertyNames(arrayMethods);
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
];
// 改写数组原型方法
function arrayPrototypeMethodsOverwrite() {
  methodsToPatch.forEach(function (method) {
    const original = arrayProto[method];
    Object.defineProperty(arrayMethods, method, {
      value: function (...args) {
        const result = original.apply(this, args);
        const ob = this.__ob__;
        switch (method) {
          case 'push':
          case 'unshift':
            inserted = args;
            break;
          case 'splice':
            inserted = args.slice(2);
            break;
        }
        if (inserted) ob.observeArray(inserted);
        ob.dep.notify();
        return result;
      },
      enumerable: false,
      writable: true,
      configurable: true,
    });
  });
}
arrayPrototypeMethodsOverwrite();
function observer(data) {
  if (Array.isArray(data) || _toString.call(data) === '[object Object]') {
    return new Observer(data);
  }
}
let uid = 0;
// 依赖收集器
class Dep {
  constructor() {
    this.id = uid++;
    // sub 存储该Dep收集器所属数据的依赖watcher
    this.subs = [];
  }
  addSub(sub) {
    this.subs.push(sub);
  }
  removeSub(sub) {
    this.subs[this.subs.indexOf(sub)] = null;
  }
  depend() {
    if (Dep.target) {
      // 互相收集
      Dep.target.addDep(this);
    }
  }
  notify() {
    const subs = this.subs.slice(0);
    for (let i = 0; i < subs.length; i++) {
      const sub = subs[i];
      sub.update();
    }
  }
}
let targetStack = [];
Dep.target = null;
function pushTarget(target) {
  targetStack.push(target);
  Dep.target = target;
}
function popTarget() {
  targetStack.pop();
  Dep.target = targetStack[targetStack.length - 1];
}
let uid_watcher = 0;
class Watcher {
  constructor(vm, expOrFn) {
    vm._watcher = this;
    this.vm = vm;
    this.uid = uid_watcher++;
    this.deps = [];
    this.depIds = new Set();
    this.getter = expOrFn;
    this.get();
  }
  get() {
    pushTarget(this);
    let value;
    const vm = this.vm;
    try {
      value = this.getter.call(vm, vm);
    } catch (err) {
      throw err;
    } finally {
      // this.cleanupDeps();
      popTarget();
    }
  }
  addDep(dep) {
    // 互相收集
    if (!this.depIds.has(dep.id)) {
      this.deps.push(dep);
      this.depIds.add(dep.id);
      dep.addSub(this);
    }
  }
  cleanupDeps() {
    let i = this.deps.length;
    while (i--) {
      const dep = this.deps[i];
      dep.removeSub(this);
    }
  }
  update() {
    this.run();
  }
  run() {
    const value = this.get();
  }
}
// 订阅者(依赖)
class Observer {
  constructor(value) {
    // 实例化依赖存储器
    this.dep = new Dep();
    Object.defineProperty(value, '__ob__', {
      value: this,
      enumerable: false,
      writable: true,
      configurable: true,
    });
    if (Array.isArray(value)) {
      // 重写数组方法
      if ('__proto__' in {}) {
        value.__proto__ = arrayMethods;
      } else {
        for (let i = 0, l = arrayKeys.length; i < l; i++) {
          const key = arrayKeys[i];
          def(value, key, arrayMethods[key]);
        }
      }
      this.observerArray(value);
    } else {
      const keys = Object.keys(value);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        defineReactive(value, key);
      }
    }
  }
  observerArray(value) {
    for (let i = 0; i < value.length; i++) {
      observer(value[i]);
    }
  }
}

function dependArray(value) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i];
    if (e && e.__ob__) {
      e.__ob__.dep.depend();
    }
    if (isArray(e)) {
      dependArray(e);
    }
  }
}

function defineReactive(obj, key) {
  // 实例化该数据的依赖存储器
  const dep = new Dep();
  let val = obj[key];
  let childObj = observer(val);
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {
      if (Dep.target) {
        // 如果依赖存储器原型的target(渲染watcher)有值，则进行依赖收集
        dep.depend();
        if (childObj) {
          childOb.dep.depend();
          if (isArray(val)) {
            dependArray(val);
          }
        }
      }
      return val;
    },
    set: function reactiveSetter(newVal) {
      if (newVal === val) return;
      val = newVal;
      childObj = observer(newVal);
      dep.notify();
    },
  });
}

class MiniVue {
  constructor(options) {
    this.$options = options;
    const { data, el, methods } = options;
    // this._data = null;
    // this._data = null;
    this.$el = document.querySelector(el);
    this.init();
  }
  init() {
    this.initData();
    this.initMethods(this);
    this.$mount();
  }
  initData() {
    let { data } = this.$options;
    data = this._data =
      typeof data === 'function' ? data.call(this, this) : data || {};
    const keys = Object.keys(data);
    let i = keys.length;
    while (i--) {
      this.proxy(this, '_data', keys[i]);
    }
    observer(data);
  }

  initMethods(vm) {
    let { methods } = this.$options;
    this._methods = methods;
    const keys = Object.keys(methods);
    let i = keys.length;
    while (i--) {
      this._methods[keys[i]] = this._methods[keys[i]].bind(vm);
      this.proxy(this, '_methods', keys[i]);
    }
  }
  proxy(target, sourceKey, key) {
    sharedPropertyDefinition.get = function proxyGetter() {
      return this[sourceKey][key];
    };
    sharedPropertyDefinition.set = function proxySetter(val) {
      this[sourceKey][key] = val;
    };
    Object.defineProperty(target, key, sharedPropertyDefinition);
  }
  $mount() {
    function _createUpdateDomFn(root) {
      const cacheTemplate = root.$el.innerHTML;
      function update(innerHtml) {
        root.$el.innerHTML = innerHtml;
      }
      return function (vm) {
        let innerHtml = cacheTemplate;
        const matched = cacheTemplate.matchAll(/\{\{([^}]+)\}\}/g);
        let current;
        while ((current = matched.next().value)) {
          const cur = current[1].trim();

          const val = vm[cur];
          innerHtml = innerHtml.replace(current[0], val);
        }
        update(innerHtml);
      };
    }
    const updateDom = _createUpdateDomFn(this);
    new Watcher(this, updateDom);
  }
}
