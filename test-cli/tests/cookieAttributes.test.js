import { TestSuite, MockServer, assert, assertEqual } from '../testUtils.js';
import { runTestSuiteIfDirect } from '../runTestSuite.js';
import { createLuminara } from 'luminara';
import { cookieJarPlugin } from '../../src/index.js';

// Create test suite and mock server with unique port
const suite = new TestSuite('Cookie Attributes');
const mockServer = new MockServer(4202);
const BASE_URL = `http://localhost:${mockServer.port}`;
const HTTPS_URL = 'https://secure.example.com';

suite.test('Should respect HttpOnly flag', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set HttpOnly cookie
	await client.jar.setCookie('session=secret; Path=/; HttpOnly', BASE_URL);
	
	// Verify it's stored
	const cookies = await client.jar.getCookies(BASE_URL);
	const sessionCookie = cookies.find(c => c.key === 'session');
	assert(sessionCookie, 'Should store HttpOnly cookie');
	assert(sessionCookie.httpOnly === true, 'Should have httpOnly flag set');
});

suite.test('Should respect Secure flag', async () => {
	const client = createLuminara({
		plugins: [cookieJarPlugin()]
	});
	
	// Set Secure cookie
	await client.jar.setCookie('secure_token=xyz; Path=/; Secure', HTTPS_URL);
	
	// Verify it's stored
	const cookies = await client.jar.getCookies(HTTPS_URL);
	const secureCookie = cookies.find(c => c.key === 'secure_token');
	assert(secureCookie, 'Should store Secure cookie');
	assert(secureCookie.secure === true, 'Should have secure flag set');
});

suite.test('Should respect Path attribute', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookie with specific path
	await client.jar.setCookie('admin=true; Path=/admin', BASE_URL);
	
	// Should NOT be sent for root path
	const rootResponse = await client.getJson('/echo-cookies');
	assert(!rootResponse.data.cookies.includes('admin=true'), 'Should not send cookie for non-matching path');
	
	// Should be sent for admin path
	const adminResponse = await client.getJson('/admin/echo-cookies');
	assert(adminResponse.data.cookies.includes('admin=true'), 'Should send cookie for matching path');
});

suite.test('Should respect Domain attribute', async () => {
	const client = createLuminara({
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookie for example.com
	await client.jar.setCookie('site=example; Domain=example.com; Path=/', 'http://example.com');
	
	// Should be available for subdomain
	const subdomainCookies = await client.jar.getCookieString('http://api.example.com');
	assert(subdomainCookies.includes('site=example'), 'Should be available for subdomain');
	
	// Should NOT be available for different domain
	const otherCookies = await client.jar.getCookieString('http://other.com');
	assert(!otherCookies.includes('site=example'), 'Should not be available for different domain');
});

suite.test('Should handle Max-Age attribute', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookie with Max-Age
	await client.jar.setCookie('temp=value; Path=/; Max-Age=3600', BASE_URL);
	
	const cookies = await client.jar.getCookies(BASE_URL);
	const tempCookie = cookies.find(c => c.key === 'temp');
	assert(tempCookie, 'Should store cookie with Max-Age');
	assert(tempCookie.maxAge !== undefined, 'Should have maxAge property');
});

suite.test('Should handle Expires attribute', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookie with future expiration
	const futureDate = new Date(Date.now() + 86400000).toUTCString(); // +1 day
	await client.jar.setCookie(`persistent=yes; Path=/; Expires=${futureDate}`, BASE_URL);
	
	const cookies = await client.jar.getCookies(BASE_URL);
	const persistentCookie = cookies.find(c => c.key === 'persistent');
	assert(persistentCookie, 'Should store cookie with Expires');
	assert(persistentCookie.expires, 'Should have expires property');
});

suite.test('Should handle SameSite attribute', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookie with SameSite
	await client.jar.setCookie('samesite=strict; Path=/; SameSite=Strict', BASE_URL);
	
	const cookies = await client.jar.getCookies(BASE_URL);
	const sameSiteCookie = cookies.find(c => c.key === 'samesite');
	assert(sameSiteCookie, 'Should store cookie with SameSite');
	assert(sameSiteCookie.sameSite, 'Should have sameSite property');
});

suite.test('Should handle cookies with multiple attributes', async () => {
	const client = createLuminara({
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookie with all attributes
	const futureDate = new Date(Date.now() + 86400000).toUTCString();
	await client.jar.setCookie(
		`complex=value; Path=/api; Domain=example.com; Secure; HttpOnly; SameSite=Lax; Expires=${futureDate}`,
		'https://api.example.com'
	);
	
	const cookies = await client.jar.getCookies('https://api.example.com/api');
	const complexCookie = cookies.find(c => c.key === 'complex');
	assert(complexCookie, 'Should store complex cookie');
	assert(complexCookie.secure === true, 'Should have secure flag');
	assert(complexCookie.httpOnly === true, 'Should have httpOnly flag');
	assert(complexCookie.path === '/api', 'Should have correct path');
});

suite.test('Should prioritize more specific paths', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookies with different paths
	await client.jar.setCookie('name=root; Path=/', BASE_URL);
	await client.jar.setCookie('name=api; Path=/api', BASE_URL);
	
	// Request to /api should get the more specific cookie
	const response = await client.getJson('/api/test');
	assert(response.data.cookies.includes('name=api'), 'Should use more specific path cookie');
});

// Enable direct execution of this test file
await runTestSuiteIfDirect(import.meta.url, 'Cookie Attributes', suite, mockServer);

// Export for test runner
export { suite, mockServer };
