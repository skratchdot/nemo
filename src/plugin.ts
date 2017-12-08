import * as debug from 'debug';
import * as Promiz from './promise';
const log = debug('nemo:log');
const error = debug('nemo:error');

log.log = console.log.bind(console);
error.log = console.error.bind(console);

export function compare (a, b) {
  let ap, bp;
  ap = !Number.isNaN(a.priority) ? a.priority : Number.MIN_VALUE;
  bp = !Number.isNaN(b.priority) ? b.priority : Number.MIN_VALUE;
  ap = ap === -1 ? Number.MAX_VALUE : ap;
  bp = bp === -1 ? Number.MAX_VALUE : bp;
  return ap - bp;
};

export function registration (nemo, plugins) {
  log('plugin.registration start');
  // @ts-ignore
  let promiz = Promiz(),
    pluginError,
    registerFns = [];
  let pluginErrored = Object.keys(plugins || {}).find(function pluginsKeys(key) {
    let pluginConfig = plugins[key],
      pluginArgs = pluginConfig.arguments || [],
      modulePath = pluginConfig.module,
      pluginModule;

    //register this plugin
    log(`register plugin ${key}`);
    try {
      pluginModule = require(modulePath);
    } catch (err) {
      pluginError = err;
      //returning true means we bail out of building registerFns
      return true;
    }
    if (pluginConfig.priority && pluginConfig.priority === 100 || Number.isNaN(pluginConfig.priority)) {
      pluginError = new Error(`Plugin priority not set properly for ${key}`);
      return true;
    }

    // @ts-ignore
    registerFns.push({
      fn: pluginReg(nemo, pluginArgs, pluginModule),
      key: key,
      priority: pluginConfig.priority || -1
    });
    return false;
  });

  if (pluginErrored) {
    error(pluginError);
    promiz.reject(pluginError);

  } else {
    log(`plugin.registration fulfill with ${registerFns.length} plugins.`);
    promiz.fulfill(registerFns);
  }
  return promiz.promise;
};

let pluginReg = function (_nemo, pluginArgs, pluginModule) {
  return function pluginReg(callback) {

    pluginArgs.push(_nemo);
    pluginArgs.push(callback);
    try {
      // @ts-ignore
      pluginModule.setup.apply(this, pluginArgs);
    } catch (err) {
      //dang, someone wrote a crap plugin
      error(err);
      let pluginSetupError = new Error('Nemo plugin threw error during setup. ' + err);
      pluginSetupError.name = 'nemoPluginSetupError';
      callback(pluginSetupError);
    }
  };
};
