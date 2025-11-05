// This file exports a utility function used to add the hosted version of the widget to a webpage
import { WIDGET_VERSION } from './config/constants';

export interface HostedParameters {
  version?: string;
  cdnBaseUrl?: string;
}

export function alephiumBridgeWidgetHosted(
  parentNode: HTMLElement,
  params: HostedParameters = {},
) {
  /* @ts-ignore */
  window.__WIDGET_CONFIG = params.config;
  /* @ts-ignore */
  window.__WIDGET_THEME = params.theme;

  const root = document.createElement('div');
  root.id = 'alephium-bridge-widget';

  const version = params.version ?? WIDGET_VERSION;
  const baseUrl =
    params.cdnBaseUrl ??
    `https://cdn.jsdelivr.net/npm/@alephium/bridge-widget@${version}`;

  const script = document.createElement('script');
  script.setAttribute('src', `${baseUrl}/dist/main.js`);
  script.setAttribute('type', 'module');

  parentNode.appendChild(root);
  parentNode.appendChild(script);
}
