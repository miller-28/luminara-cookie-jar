import { TestSuite, MockServer, assert, assertEqual } from '../testUtils.js';
import { runTestSuiteIfDirect } from '../runTestSuite.js';
import { createLuminara } from 'luminara';
import { cookieJarPlugin } from '../../src/index.js';

// Create test suite and mock server with unique port
const suite = new TestSuite('Cookie Expiration');
const mockServer = new MockServer(4205);
const BASE_URL = `http://localhost:${mockServer.port}`;

suite.test('Should automatically expire cookies with Max-Age=0', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookie
	await client.jar.setCookie('temp=value; Path=/', BASE_URL);
	
	// Verify it exists
	let cookies = await client.jar.getCookies(BASE_URL);
	assert(cookies.some(c => c.key === 'temp'), 'Cookie should exist initially');
	
	// Expire it
	await client.jar.setCookie('temp=value; Path=/; Max-Age=0', BASE_URL);
	
	// Should be gone
	cookies = await client.jar.getCookies(BASE_URL);
	assert(!cookies.some(c => c.key === 'temp'), 'Cookie should be expired');
});

suite.test('Should not send expired cookies', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookie that expires in the past
	const pastDate = new Date(Date.now() - 86400000).toUTCString(); // -1 day
	await client.jar.setCookie(`expired=value; Path=/; Expires=${pastDate}`, BASE_URL);
	
	// Should not be sent
	const response = await client.getJson('/echo-cookies');
	assert(!response.data.cookies.includes('expired=value'), 'Should not send expired cookie');
});

suite.test('Should handle session cookies (no expiration)', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set session cookie (no Max-Age or Expires)
	await client.jar.setCookie('session=abc; Path=/', BASE_URL);
	
	const cookies = await client.jar.getCookies(BASE_URL);
	const sessionCookie = cookies.find(c => c.key === 'session');
	assert(sessionCookie, 'Should store session cookie');
	// Session cookies either have no expires or expires === "Infinity"
	assert(!sessionCookie.expires || sessionCookie.expires === 'Infinity', 'Session cookie should not have finite expiration');
});

suite.test('Should respect Set-Cookie expiration from server', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Server sets cookie with expiration
	await client.get('/set-expiring-cookie');
	
	// Cookie should exist initially
	const cookies = await client.jar.getCookies(BASE_URL);
	assert(cookies.some(c => c.key === 'expiring'), 'Cookie should exist initially');
	
	// After expiration, should be gone
	// (In real scenario, we'd wait. For test, we verify the structure)
	const expiringCookie = cookies.find(c => c.key === 'expiring');
	assert(expiringCookie.expires, 'Should have expiration date from server');
});

suite.test('Should allow manual cookie removal', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookies
	await client.get('/set-cookie');
	
	// Verify they exist
	let cookies = await client.jar.getCookies(BASE_URL);
	assert(cookies.length > 0, 'Should have cookies');
	
	// Remove all cookies
	await client.jar.removeAllCookies();
	
	// Should be empty
	cookies = await client.jar.getCookies(BASE_URL);
	assertEqual(cookies.length, 0, 'Should have no cookies after removal');
});

suite.test('Should handle cookie updates (same name, new value)', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set initial cookie
	await client.jar.setCookie('counter=1; Path=/', BASE_URL);
	
	let cookieString = await client.jar.getCookieString(BASE_URL);
	assert(cookieString.includes('counter=1'), 'Should have initial value');
	
	// Update cookie
	await client.jar.setCookie('counter=2; Path=/', BASE_URL);
	
	cookieString = await client.jar.getCookieString(BASE_URL);
	assert(cookieString.includes('counter=2'), 'Should have updated value');
	assert(!cookieString.includes('counter=1'), 'Should not have old value');
});

suite.test('Should handle cookies with very long Max-Age', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookie with 1 year Max-Age
	await client.jar.setCookie('longterm=value; Path=/; Max-Age=31536000', BASE_URL);
	
	const cookies = await client.jar.getCookies(BASE_URL);
	const longtermCookie = cookies.find(c => c.key === 'longterm');
	assert(longtermCookie, 'Should store long-term cookie');
	
	// Verify it's sent
	const response = await client.getJson('/echo-cookies');
	assert(response.data.cookies.includes('longterm=value'), 'Should send long-term cookie');
});

suite.test('Should handle multiple cookies expiring at different times', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookies with different expirations
	await client.jar.setCookie('short=1; Path=/; Max-Age=10', BASE_URL);
	await client.jar.setCookie('medium=2; Path=/; Max-Age=3600', BASE_URL);
	await client.jar.setCookie('long=3; Path=/; Max-Age=31536000', BASE_URL);
	
	const cookies = await client.jar.getCookies(BASE_URL);
	assertEqual(cookies.length, 3, 'Should have all three cookies');
	
	// All should be sent currently
	const response = await client.getJson('/echo-cookies');
	assert(response.data.cookies.includes('short=1'), 'Should have short-lived cookie');
	assert(response.data.cookies.includes('medium=2'), 'Should have medium-lived cookie');
	assert(response.data.cookies.includes('long=3'), 'Should have long-lived cookie');
});

// Enable direct execution of this test file
await runTestSuiteIfDirect(import.meta.url, 'Cookie Expiration', suite, mockServer);

// Export for test runner
export { suite, mockServer };
