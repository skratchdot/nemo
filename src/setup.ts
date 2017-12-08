import * as async from 'async';
import * as debug from 'debug';
import * as wd from 'selenium-webdriver';
import { Driver } from './driver';
import { Install as seleniumInstall } from './install';
import { compare, registration } from './plugin';
import { Promiz } from './promise';
const log = debug('nemo:log');
const error = debug('nemo:error');

log.log = console.log.bind(console);
error.log = console.error.bind(console);

const setup = function setup(config, cb) {
  const nemo = {
    data: config.get('data'),
    driver: {},
    _config: config
  };
  registration(nemo, config.get('plugins'))
    .then(function(registerFns) {
      //add driver setup
      registerFns.push({ fn: driversetup(nemo), priority: 100 });
      registerFns = registerFns.sort(compare).map(function(obj) {
        return obj.fn;
      });
      registerFns.unshift(function setWebdriver(callback) {
        // @ts-ignore
        nemo.wd = wd;
        callback(null);
      });
      if (config.get('driver:selenium.version')) {
        //install before driver setup
        log(
          'Requested install of selenium version %s',
          config.get('driver:selenium.version')
        );
        registerFns.unshift(
          seleniumInstall(config.get('driver:selenium.version'))
        );
      }
      async.waterfall(registerFns, function waterfall(err) {
        if (err) {
          cb(err);
        } else {
          cb(null, nemo);
        }
      });
    })
    .catch(function(err) {
      error(err);
      cb(err);
    });
};

const driversetup = function(_nemo) {
  return function driversetup(callback) {
    const driverConfig = _nemo._config.get('driver');
    //do driver/view/locator/vars setup
    // @ts-ignore
    Driver().setup(driverConfig, function setupCallback(err, _driver) {
      if (err) {
        callback(err);
        return;
      }
      //set driver
      _nemo.driver = _driver;
      callback(null);
    });
  };
};

export function Setup(config) {
  const promiz = Promiz();
  if (config.get('driver') === undefined) {
    const errorMessage =
      'Nemo essential driver properties not found in configuration';
    error(errorMessage);
    const badDriverProps = new Error(errorMessage);
    badDriverProps.name = 'nemoBadDriverProps';
    process.nextTick(function() {
      promiz.reject(badDriverProps);
    });
  } else {
    setup(config, function(err, nemo) {
      log('got called back');
      if (err !== null) {
        promiz.reject(err);
        return;
      }
      promiz.fulfill(nemo);
    });
  }

  return promiz.promise;
}
