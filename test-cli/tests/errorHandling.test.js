import { TestSuite, MockServer, assert, assertEqual } from '../testUtils.js';
import { runTestSuiteIfDirect } from '../runTestSuite.js';
import { createLuminara } from 'luminara';
import { cookieJarPlugin } from '../../src/index.js';

// Create test suite and mock server with unique port
const suite = new TestSuite('Error Handling');
const mockServer = new MockServer(4204);
const BASE_URL = `http://localhost:${mockServer.port}`;

suite.test('Should handle malformed Set-Cookie headers gracefully', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Server sends malformed cookie (will be tested via mock)
	// The plugin should not crash
	await client.get('/set-malformed-cookie');
	
	// Request should succeed even if cookie parsing fails
	const response = await client.getJson('/echo-cookies');
	assert(response, 'Request should succeed despite malformed cookie');
});

suite.test('Should handle invalid cookie names', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Try to set cookie with invalid name (tough-cookie will reject)
	try {
		await client.jar.setCookie('invalid name=value; Path=/', BASE_URL);
	} catch (err) {
		// Expected - tough-cookie rejects invalid cookie names
		assert(err, 'Should throw for invalid cookie name');
	}
	
	// But requests should still work
	const response = await client.getJson('/echo-cookies');
	assert(response, 'Requests should still work after error');
});

suite.test('Should continue working after cookie storage error', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Try to set an invalid cookie
	try {
		await client.jar.setCookie('', BASE_URL); // Empty cookie string
	} catch (err) {
		// Expected error
	}
	
	// Normal operations should continue
	await client.get('/set-cookie');
	const response = await client.getJson('/echo-cookies');
	assert(response.data.cookies.includes('session=abc123'), 'Should work normally after error');
});

suite.test('Should handle missing URL in cookie operations', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	try {
		// Try to get cookies without URL
		await client.jar.getCookies('');
		assert(false, 'Should throw for empty URL');
	} catch (err) {
		assert(err, 'Should handle empty URL gracefully');
	}
});

suite.test('Should handle network errors without affecting cookies', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()],
		retry: 0 // Disable retry for this test
	});
	
	// Set cookies first
	await client.get('/set-cookie');
	
	// Make request that will fail
	try {
		await client.get('/force-error');
	} catch (err) {
		// Expected error
		assert(err, 'Should throw network error');
	}
	
	// Cookies should still be intact
	const cookies = await client.jar.getCookies(BASE_URL);
	assert(cookies.length > 0, 'Cookies should survive network errors');
});

suite.test('Should handle concurrent cookie operations', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set multiple cookies concurrently
	await Promise.all([
		client.jar.setCookie('cookie1=value1; Path=/', BASE_URL),
		client.jar.setCookie('cookie2=value2; Path=/', BASE_URL),
		client.jar.setCookie('cookie3=value3; Path=/', BASE_URL)
	]);
	
	const cookies = await client.jar.getCookies(BASE_URL);
	assertEqual(cookies.length, 3, 'Should handle concurrent cookie operations');
});

suite.test('Should handle retry logic with cookies', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()],
		retry: 2,
		retryDelay: 100
	});
	
	// Set cookies
	await client.get('/set-cookie');
	
	// Make request that might retry (cookies should be sent on each attempt)
	const response = await client.getJson('/echo-cookies');
	assert(response.data.cookies.includes('session=abc123'), 'Cookies should be sent on retries');
});

suite.test('Should handle requests without responses', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()],
		timeout: 1000
	});
	
	// Set cookies first
	await client.get('/set-cookie');
	
	try {
		// Request that times out
		await client.get('/timeout');
	} catch (err) {
		assert(err.code === 'TIMEOUT' || err.name === 'TimeoutError', 'Should timeout');
	}
	
	// Cookies should still work after timeout
	const response = await client.getJson('/echo-cookies');
	assert(response.data.cookies.includes('session=abc123'), 'Cookies should work after timeout');
});

suite.test('Should handle abort signals with cookies', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookies
	await client.get('/set-cookie');
	
	// Create abort controller
	const controller = new AbortController();
	
	// Abort immediately
	setTimeout(() => controller.abort(), 10);
	
	try {
		await client.get('/slow-response', { signal: controller.signal });
	} catch (err) {
		assert(err.code === 'ABORT' || err.name === 'AbortError', 'Should be aborted');
	}
	
	// Cookies should still be intact
	const cookies = await client.jar.getCookies(BASE_URL);
	assert(cookies.length > 0, 'Cookies should survive abort');
});

suite.test('Should handle empty Set-Cookie headers', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Request with no Set-Cookie headers
	const response = await client.getJson('/no-cookies');
	assert(response, 'Should handle responses without Set-Cookie');
	
	// Should still be able to send existing cookies
	await client.get('/set-cookie');
	const response2 = await client.getJson('/echo-cookies');
	assert(response2.data.cookies.includes('session=abc123'), 'Should still handle cookies normally');
});

// Enable direct execution of this test file
await runTestSuiteIfDirect(import.meta.url, 'Error Handling', suite, mockServer);

// Export for test runner
export { suite, mockServer };
