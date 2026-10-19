// Mini registro de telemetría con el mismo patrón que Open MCT:
//  - cada dato (canal) tiene nombre, unidad y metadatos (valores con hints domain/range)
//  - un proveedor declara supportsRequest/request (histórico) y supportsSubscribe/subscribe (en vivo)
//  - addProvider usa unshift: el último registrado gana (Open MCT: TelemetryAPI.js:167)
export class TelemetryRegistry {
  constructor() {
    this.providers = [];
    this.channels = new Map();
  }

  addChannel(channel) {
    this.channels.set(channel.key, channel);
  }

  addProvider(provider) {
    this.providers.unshift(provider);
  }

  getMetadata(key) {
    return this.channels.get(key);
  }

  #find(channel, method) {
    return this.providers.find((p) => p[`supports${method}`]?.(channel));
  }

  request(key) {
    const channel = this.channels.get(key);
    const provider = this.#find(channel, 'Request');
    if (!provider) return Promise.reject(new Error(`Ningún proveedor sirve histórico para ${key}`));
    return provider.request(channel);
  }

  subscribe(key, callback) {
    const channel = this.channels.get(key);
    const provider = this.#find(channel, 'Subscribe');
    return provider ? provider.subscribe(channel, callback) : () => {};
  }
}
