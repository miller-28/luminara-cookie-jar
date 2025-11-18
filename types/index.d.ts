// types/index.d.ts
import { CookieJar } from 'tough-cookie';

export interface CookieJarPluginOptions {
	/**
	 * Provide your own CookieJar instance to share across clients.
	 * If omitted, the plugin will create a new jar per client.
	 */
	jar?: CookieJar;
}

export interface LuminaraPlugin {
	name: string;
	onRequest?: (context: any) => Promise<void> | void;
	onResponse?: (context: any) => Promise<void> | void;
	onResponseError?: (context: any) => Promise<void> | void;
	_jar?: CookieJar | null;
}

export function cookieJarPlugin(options?: CookieJarPluginOptions): LuminaraPlugin;

// Module augmentation for Luminara client
declare module 'luminara' {
	interface LuminaraClient {
		/**
		 * Cookie jar attached by luminara-cookiejar plugin.
		 */
		jar?: CookieJar;
	}
}
