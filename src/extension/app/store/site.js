/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

// import { property } from 'lit/decorators.js';
import { observable, action } from 'mobx';
import { log } from '../../log.js';
import { getAdminUrl, getAdminFetchOptions } from '../utils/helix-admin.js';
import { getLanguage } from '../utils/i18n.js';

/**
 * The sidekick options configuration object type
 * @typedef {import('@Types').SidekickOptionsConfig} SidekickOptionsConfig
 */

/**
 * The sidekick configuration object type
 * @typedef {import('@Types').SidekickConfig} SidekickConfig
 */

/**
 * @typedef {import('./app.js').AppStore} AppStore
 */

/**
 * The CustomPlugin type
 * @typedef {import('@Types').CustomPlugin} CustomPlugin
 */

export class SiteStore {
  /**
   * The GitHub owner or organization (mandatory)
   * @type {string}
   */
  owner;

  /**
   * The GitHub repo (mandatory)
   * @type {string}
   */
  repo;

  /**
   * The Git reference or branch (optional)
   * @type {string}
   */
  ref;

  /**
   * The url to the repository
   * @type {string}
   */
  giturl;

  /**
   * The content source URL (optional)
   * @type {string}
   */
  mountpoint;

  /**
   * An arround of content source URLs (optional)
   * @type {string[]}
   */
  mountpoints;

  /**
   * The name of the project used in the sharing link (optional)
   * @type {string}
   */
  project;

  /**
   * The production host name to publish content to (optional)
   * @type {string}
   */
  host;

  /**
   * The host name of a custom preview CDN (optional)
   * @type {string}
   */
  previewHost;

  /**
   * Inner CDN host name (custom or std)
   * @type {string}
   */
  innerHost;

  /**
   * Standard Inner CDN host name
   * @type {string}
   */
  stdInnerHost;

  /**
   * The host name of a custom live CDN (optional)
   * @type {string}
   */
  liveHost;

  /**
   * Inner CDN host name (custom or std)
   * @type {string}
   */
  outerHost;

  /**
   * Standard Outer CDN host name
   * @type {string}
   */
  stdOuterHost;

  /**
   * Loads configuration and plugins from the development environment
   * @type {boolean}
   */
  devMode;

  /**
   * URL of the local development environment
   * @type {string}
   */
  devOrigin;

  /**
   * The specific version of admin service to use (optional)
   * @type {string}
   */
  adminVersion;

  /**
   * User language preference
   * @type {string}
   */
  lang;

  /**
   * Custom views
   * @type {import('@Types').ViewConfig[]}
   */
  views;

  /**
   * Custom views
   * @type {CustomPlugin[]}
   */
  plugins;

  /**
   * Are we currently authorized for the site?
   * Since the config fetch is the first request, we need to track it's
   * response status early so the UI can render appropriately.
   * @type {boolean}
   */
  authorized = false;

  /**
   * Custom views
   * @type {number}
   */
  authTokenExpiry;

  /**
   * Has the store been initialized?
   * @type {boolean}
   */
  @observable accessor ready = false;

  /**
   * @param {AppStore} appStore
   */
  constructor(appStore) {
    this.appStore = appStore;
  }

  /**
   * Set as initialized.
   */
  @action
  setReady() {
    this.ready = true;
  }

  /**
   * Initializes the site store
   * @param {SidekickOptionsConfig} cfg
   */
  async initStore(cfg) {
    let config = cfg || (window.hlx && window.hlx.sidekickConfig) || {};
    const {
      owner,
      repo,
      ref = 'main',
      giturl,
      mountpoints,
      devMode,
      adminVersion,
      _extended,
    } = config;
    let { devOrigin } = config;
    if (!devOrigin) {
      devOrigin = 'http://localhost:3000';
    }
    if (owner && repo && !_extended) {
      // look for custom config in project
      const configUrl = devMode
        ? `${devOrigin}/tools/sidekick/config.json`
        : getAdminUrl(config, 'sidekick', '/config.json');
      try {
        const res = await fetch(configUrl, getAdminFetchOptions(true));
        if (res.status === 200) {
          this.authorized = true;
          config = {
            ...config,
            ...(await res.json()),
            // no overriding below
            owner,
            repo,
            ref,
            devMode,
            adminVersion,
            _extended: Date.now(),
          };
        } else if (res.status !== 404) {
          this.authorized = false;
        }
      } catch (e) {
        /* istanbul ignore next */
        log.debug('error retrieving custom sidekick config', e);
      }
    }

    const {
      lang,
      previewHost,
      liveHost,
      outerHost: legacyLiveHost,
      host,
      project = '',
      specialViews,
      scriptUrl = 'https://www.hlx.live/tools/sidekick/index.js',
    } = config;
    const publicHost = host && host.startsWith('http') ? new URL(host).host : host;
    const hostPrefix = owner && repo ? `${ref}--${repo}--${owner}` : null;
    const domain = previewHost?.endsWith('.aem.page') ? 'aem' : 'hlx';
    const stdInnerHost = hostPrefix ? `${hostPrefix}.${domain}.page` : null;
    const stdOuterHost = hostPrefix ? `${hostPrefix}.${domain}.live` : null;
    const devUrl = new URL(devOrigin);

    // default views
    this.views = [
      {
        path: '**.json',
        viewer: chrome.runtime.getURL('view/json/json.html'),
        title: () => this.appStore.i18n('json_view_description'),
      },
    ];
    // prepend custom views
    this.views = (specialViews || []).concat(this.views);
    this.plugins = config.plugins || [];

    this.owner = owner;
    this.repo = repo;
    this.ref = ref;
    this.giturl = giturl;
    this.mountpoints = mountpoints || [];
    [this.mountpoint] = this.mountpoints;
    this.devMode = devMode;
    this.adminVersion = adminVersion;
    this._extended = _extended;

    this.previewHost = previewHost;
    this.liveHost = liveHost;
    this.scriptUrl = scriptUrl;

    this.innerHost = previewHost || stdInnerHost;
    this.outerHost = liveHost || legacyLiveHost || stdOuterHost;
    this.stdInnerHost = stdInnerHost;
    this.stdOuterHost = stdOuterHost;
    this.host = publicHost;
    this.project = project;
    this.devUrl = devUrl;
    this.lang = lang || getLanguage();
    this.setReady();
  }

  /**
   * Serializes the store to JSON
   * @returns { SidekickConfig }
   */
  toJSON() {
    return {
      owner: this.owner,
      repo: this.repo,
      ref: this.ref,
      giturl: this.giturl,
      devUrl: this.devUrl.href,
      // @ts-ignore
      mountpoint: this.mountpoint,
      mountpoints: this.mountpoints,
      project: this.project,
      host: this.host,
      previewHost: this.previewHost,
      innerHost: this.innerHost,
      stdInnerHost: this.stdInnerHost,
      liveHost: this.liveHost,
      outerHost: this.outerHost,
      stdOuterHost: this.stdOuterHost,
      devMode: this.devMode,
      devOrigin: this.devOrigin,
      adminVersion: this.adminVersion,
      lang: this.lang,
      views: this.views,
    };
  }
}
