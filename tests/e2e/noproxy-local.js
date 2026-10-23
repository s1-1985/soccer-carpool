// firebase-tools は HTTPS_PROXY があると NO_PROXY を見ずに 127.0.0.1 宛ても proxy 経由にするため、
// ローカル（エミュレータ間）通信だけ直接つなぐ。外向き通信は従来どおり proxy を通る
const path = require('path');
const undici = require(path.join(process.env.FT_NODE_MODULES, 'undici'));
const Orig = undici.ProxyAgent;
const direct = new undici.Agent();
class LocalBypassProxyAgent extends undici.Dispatcher {
  constructor(opts) { super(); this.proxy = new Orig(opts); }
  dispatch(opts, handler) {
    const o = String(opts.origin || '');
    const local = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\/?$/.test(o);
    return (local ? direct : this.proxy).dispatch(opts, handler);
  }
  close(...a) { return this.proxy.close(...a); }
  destroy(...a) { return this.proxy.destroy(...a); }
}
undici.ProxyAgent = LocalBypassProxyAgent;
