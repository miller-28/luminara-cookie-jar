import { TestSuite, MockServer, assert, assertEqual } from '../testUtils.js';
import { runTestSuiteIfDirect } from '../runTestSuite.js';
import { createLuminara } from 'luminara';
import { cookieJarPlugin } from '../../src/index.js';

// Create test suite and mock server with unique port
const suite = new TestSuite('Basic Cookie Operations');
const mockServer = new MockServer(4201);
const BASE_URL = `http://localhost:${mockServer.port}`;

suite.test('Should set cookies from Set-Cookie header', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});

	const response = await client.getJson('/set-cookie');
	assertEqual(response.data.count, 3, 'Should receive confirmation of 3 cookies');

	// Verify client.jar is attached
	assert(client.jar, 'Should have client.jar attached');
	assert(typeof client.jar.getCookieString === 'function', 'Should have getCookieString method');
});

suite.test('Should send cookies in subsequent requests', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});

	// First request sets cookies
	await client.get('/set-cookie');

	// Second request should send cookies
	const echoResponse = await client.getJson('/echo-cookies');
	assert(echoResponse.data.cookies.includes('session=abc123'), 'Should send session cookie');
	assert(echoResponse.data.cookies.includes('user_id=12345'), 'Should send user_id cookie');
});

suite.test('Should persist cookies across multiple requests', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});

	// Set cookies
	await client.get('/set-cookie');

	// Make multiple requests
	for (let i = 0; i < 3; i++) {
		const response = await client.getJson('/echo-cookies');
		assert(response.data.cookies.includes('session=abc123'), `Request ${i + 1} should have cookies`);
	}
});

suite.test('Should expose client.jar API', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});

	// Set some cookies
	await client.get('/set-cookie');

	// Verify client.jar API is available
	assert(client.jar, 'Should have client.jar attached');
	assert(typeof client.jar.getCookieString === 'function', 'Should have getCookieString method');

	const cookieString = await client.jar.getCookieString(BASE_URL);
	assert(cookieString.length > 0, 'Should have stored cookies');
	assert(cookieString.includes('session=abc123'), 'Should include session cookie');
});

suite.test('Should work with client.use() pattern', async () => {
	const client = createLuminara({
		baseURL: BASE_URL
	});
	
	client.use(cookieJarPlugin());

	// Set cookies
	await client.get('/set-cookie');

	// Verify cookies are sent
	const echoResponse = await client.getJson('/echo-cookies');
	assert(echoResponse.data.cookies.includes('session=abc123'), 'Should send cookies with client.use() pattern');
});

suite.test('Should handle requests without baseURL', async () => {
	const client = createLuminara({
		plugins: [cookieJarPlugin()]
	});

	// Use absolute URL without baseURL configuration
	const setResponse = await client.getJson(`${BASE_URL}/set-cookie`);
	assertEqual(setResponse.data.count, 3, 'Should set cookies with absolute URL');

	const echoResponse = await client.getJson(`${BASE_URL}/echo-cookies`);
	assert(echoResponse.data.cookies.includes('session=abc123'), 'Should send cookies with absolute URL');
});

suite.test('Should handle protected routes', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});

	// Manually set auth cookie
	await client.jar.setCookie(
		'auth_token=secret123; Path=/',
		BASE_URL
	);

	// Protected route should work
	const response = await client.getJson('/protected');
	assertEqual(response.data.message, 'Access granted', 'Should access protected route with auth cookie');
	assert(response.data.cookies.includes('auth_token=secret123'), 'Should send auth cookie');
});

// Enable direct execution of this test file
await runTestSuiteIfDirect(import.meta.url, 'Basic Cookie Operations', suite, mockServer);

// Export for test runner
export { suite, mockServer };
