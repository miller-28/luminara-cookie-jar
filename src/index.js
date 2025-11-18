// src/index.js
import { CookieJar } from 'tough-cookie';

/**
 * @typedef {Object} CookieJarPluginOptions
 * @property {CookieJar} [jar] - Provide your own CookieJar instance to share across clients.
 */

/**
 * Creates a Luminara plugin for automatic cookie management.
 * @param {CookieJarPluginOptions} [options={}] - Plugin configuration
 * @returns {Object} Luminara plugin object
 */
export function cookieJarPlugin(options = {}) {
	const { jar: externalJar } = options;
	const jar = externalJar ?? new CookieJar();

	return {
		name: 'cookie-jar',

		onAttach(client) {
			client.jar = jar;
		},

		async onRequest(context) {
			const url = resolveAbsoluteUrl(context);
			const headers = context.req.headers || {};
			const existingCookie = headers['Cookie'] || headers['cookie'] || '';
			const jarCookie = await jar.getCookieString(url);

			if (jarCookie) {
				const mergedCookie = existingCookie
					? `${existingCookie}; ${jarCookie}`
					: jarCookie;

				context.req.headers = {
					...headers,
					'Cookie': mergedCookie
				};
			}
		},

		async onResponse(context) {
			const url = resolveAbsoluteUrl(context);
			await storeSetCookiesFromResponse(jar, url, context.res);
		},
	};
}

/**
 * Resolves absolute URL from request context.
 */
function resolveAbsoluteUrl(context) {
	if (context.url) {
		return context.url;
	}

	const requestUrl = context.req?.url || '';

	if (requestUrl.startsWith('http://') || requestUrl.startsWith('https://')) {
		return requestUrl;
	}

	const base = context.req?.baseURL || context.client?.config?.baseURL || '';

	if (!base) {
		return requestUrl;
	}

	return base.replace(/\/$/, '') + '/' + requestUrl.replace(/^\//, '');
}

/**
 * Extracts and stores Set-Cookie headers from response.
 */
async function storeSetCookiesFromResponse(jar, url, res) {
	if (!res || !res.headers) {
		return;
	}

	const rawHeaders = res.headers;
	let setCookieValues = [];

	// Modern fetch (Node.js 18+)
	if (typeof rawHeaders.getSetCookie === 'function') {
		setCookieValues = rawHeaders.getSetCookie();
	} else if (typeof rawHeaders.get === 'function') {
		const single = rawHeaders.get('set-cookie');
		if (single) {
			setCookieValues.push(single);
		}
	}

	// Node-like response headers
	const maybeArray =
		res.raw?.headers?.['set-cookie'] ||
		res.meta?.['set-cookie'];

	if (Array.isArray(maybeArray)) {
		setCookieValues.push(...maybeArray);
	}

	// Deduplicate
	const seen = new Set();
	setCookieValues = setCookieValues.filter((value) => {
		if (seen.has(value)) {
			return false;
		}
		seen.add(value);
		return true;
	});

	// Store cookies
	for (const value of setCookieValues) {
		try {
			await new Promise((resolve, reject) => {
				jar.setCookie(value, url, (err) => {
					if (err) {
						return reject(err);
					}
					resolve();
				});
			});
		} catch (error) {
			console.warn(`[cookie-jar] Failed to store cookie: ${error.message}`);
		}
	}
}
