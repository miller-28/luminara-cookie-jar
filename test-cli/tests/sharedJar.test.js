import { TestSuite, MockServer, assert, assertEqual } from '../testUtils.js';
import { runTestSuiteIfDirect } from '../runTestSuite.js';
import { createLuminara } from 'luminara';
import { cookieJarPlugin } from '../../src/index.js';
import { CookieJar } from 'tough-cookie';

// Create test suite and mock server with unique port
const suite = new TestSuite('Shared Cookie Jar');
const mockServer = new MockServer(4206);
const BASE_URL = `http://localhost:${mockServer.port}`;

suite.test('Should share cookies between two clients with shared jar', async () => {
	const sharedJar = new CookieJar();
	
	const client1 = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin({ jar: sharedJar })]
	});
	
	const client2 = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin({ jar: sharedJar })]
	});
	
	// Client 1 sets cookies
	await client1.get('/set-cookie');
	
	// Client 2 should have access to those cookies
	const response = await client2.getJson('/echo-cookies');
	assert(response.data.cookies.includes('session=abc123'), 'Client 2 should have cookies from client 1');
});

suite.test('Should maintain separate cookies with separate jars', async () => {
	const client1 = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()] // Independent jar
	});
	
	const client2 = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()] // Independent jar
	});
	
	// Client 1 sets cookies
	await client1.get('/set-cookie');
	
	// Client 2 should NOT have those cookies
	const response = await client2.getJson('/echo-cookies');
	assertEqual(response.data.cookies, 'none', 'Client 2 should have no cookies');
});

suite.test('Should expose jar instance on both clients with shared jar', async () => {
	const sharedJar = new CookieJar();
	
	const client1 = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin({ jar: sharedJar })]
	});
	
	const client2 = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin({ jar: sharedJar })]
	});
	
	// Set cookie via client1.jar
	await client1.jar.setCookie('test=value; Path=/', BASE_URL);
	
	// Read via client2.jar
	const cookies = await client2.jar.getCookies(BASE_URL);
	assert(cookies.some(c => c.key === 'test' && c.value === 'value'), 'Should access same jar from both clients');
});

suite.test('Should synchronize cookies in real-time across clients', async () => {
	const sharedJar = new CookieJar();
	
	const client1 = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin({ jar: sharedJar })]
	});
	
	const client2 = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin({ jar: sharedJar })]
	});
	
	// Client 1 makes request that sets cookies
	await client1.get('/set-cookie');
	
	// Client 2 immediately has access
	const cookieString = await client2.jar.getCookieString(BASE_URL);
	assert(cookieString.includes('session=abc123'), 'Cookies should be immediately available');
	
	// Client 2 makes request that sets different cookies
	await client2.getJson('/set-custom-cookie?name=user&value=john');
	
	// Client 1 now has both sets of cookies
	const allCookies = await client1.jar.getCookies(BASE_URL);
	assert(allCookies.length >= 2, 'Should have cookies from both clients');
});

suite.test('Should handle concurrent requests with shared jar', async () => {
	const sharedJar = new CookieJar();
	
	const client1 = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin({ jar: sharedJar })]
	});
	
	const client2 = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin({ jar: sharedJar })]
	});
	
	// Both clients set cookies concurrently
	await Promise.all([
		client1.getJson('/set-custom-cookie?name=client1&value=data1'),
		client2.getJson('/set-custom-cookie?name=client2&value=data2')
	]);
	
	// Both cookies should be in the jar
	const cookies = await sharedJar.getCookies(BASE_URL);
	const cookieNames = cookies.map(c => c.key);
	assert(cookieNames.includes('client1'), 'Should have client1 cookie');
	assert(cookieNames.includes('client2'), 'Should have client2 cookie');
});

// Enable direct execution of this test file
await runTestSuiteIfDirect(import.meta.url, 'Shared Cookie Jar', suite, mockServer);

// Export for test runner
export { suite, mockServer };
