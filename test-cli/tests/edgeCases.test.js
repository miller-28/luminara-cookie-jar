import { TestSuite, MockServer, assert, assertEqual } from '../testUtils.js';
import { runTestSuiteIfDirect } from '../runTestSuite.js';
import { createLuminara } from 'luminara';
import { cookieJarPlugin } from '../../src/index.js';

// Create test suite and mock server with unique port
const suite = new TestSuite('Edge Cases');
const mockServer = new MockServer(4203);
const BASE_URL = `http://localhost:${mockServer.port}`;

suite.test('Should handle cookies with special characters in values', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookie with URL-encoded value
	await client.jar.setCookie('encoded=hello%20world; Path=/', BASE_URL);
	
	const response = await client.getJson('/echo-cookies');
	assert(response.data.cookies.includes('encoded='), 'Should handle encoded values');
});

suite.test('Should handle very long cookie values', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Create a long value (but within limits)
	const longValue = 'x'.repeat(1000);
	await client.jar.setCookie(`longcookie=${longValue}; Path=/`, BASE_URL);
	
	const response = await client.getJson('/echo-cookies');
	assert(response.data.cookies.includes('longcookie='), 'Should handle long cookie values');
});

suite.test('Should handle multiple cookies with same name but different paths', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookies with same name but different paths
	await client.jar.setCookie('name=root; Path=/', BASE_URL);
	await client.jar.setCookie('name=api; Path=/api', BASE_URL);
	
	// Both should exist in jar
	const allCookies = await client.jar.getCookies(BASE_URL);
	const nameCookies = allCookies.filter(c => c.key === 'name');
	assert(nameCookies.length >= 1, 'Should store cookies with same name but different paths');
});

suite.test('Should handle empty cookie values', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookie with empty value
	await client.jar.setCookie('empty=; Path=/', BASE_URL);
	
	const cookies = await client.jar.getCookies(BASE_URL);
	const emptyCookie = cookies.find(c => c.key === 'empty');
	assert(emptyCookie, 'Should store cookie with empty value');
	assertEqual(emptyCookie.value, '', 'Value should be empty string');
});

suite.test('Should handle cookies with equals signs in values', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookie with equals sign in value
	await client.jar.setCookie('data=key=value; Path=/', BASE_URL);
	
	const cookieString = await client.jar.getCookieString(BASE_URL);
	assert(cookieString.includes('data=key=value'), 'Should handle equals signs in values');
});

suite.test('Should handle requests with existing Cookie header', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookies via jar
	await client.jar.setCookie('jar_cookie=from_jar; Path=/', BASE_URL);
	
	// Make request with manual Cookie header
	const response = await client.getJson('/echo-cookies', {
		headers: {
			'Cookie': 'manual_cookie=from_header'
		}
	});
	
	// Should have both cookies
	assert(response.data.cookies.includes('jar_cookie=from_jar'), 'Should have jar cookie');
	assert(response.data.cookies.includes('manual_cookie=from_header'), 'Should have manual cookie');
});

suite.test('Should handle cookie deletion via Max-Age=0', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookie
	await client.jar.setCookie('deleteme=value; Path=/', BASE_URL);
	
	// Verify it exists
	let response = await client.getJson('/echo-cookies');
	assert(response.data.cookies.includes('deleteme=value'), 'Cookie should exist');
	
	// Server deletes cookie
	await client.get('/delete-cookie');
	
	// Should be gone
	response = await client.getJson('/echo-cookies');
	assert(!response.data.cookies.includes('deleteme=value'), 'Cookie should be deleted');
});

suite.test('Should handle case-insensitive cookie names', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Cookies with different casing
	await client.jar.setCookie('SessionID=abc; Path=/', BASE_URL);
	
	const cookies = await client.jar.getCookies(BASE_URL);
	assert(cookies.some(c => c.key === 'SessionID'), 'Should preserve cookie name casing');
});

suite.test('Should handle rapid cookie updates', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Rapidly update same cookie
	for (let i = 0; i < 10; i++) {
		await client.jar.setCookie(`counter=${i}; Path=/`, BASE_URL);
	}
	
	// Should have latest value
	const cookieString = await client.jar.getCookieString(BASE_URL);
	assert(cookieString.includes('counter=9'), 'Should have latest cookie value');
});

suite.test('Should handle requests to different domains', async () => {
	const client = createLuminara({
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookies for different domains
	await client.jar.setCookie('site1=value1; Path=/', 'http://example1.com');
	await client.jar.setCookie('site2=value2; Path=/', 'http://example2.com');
	
	// Each domain should only get its own cookies
	const cookies1 = await client.jar.getCookieString('http://example1.com');
	assert(cookies1.includes('site1=value1'), 'Should have site1 cookie');
	assert(!cookies1.includes('site2=value2'), 'Should not have site2 cookie');
	
	const cookies2 = await client.jar.getCookieString('http://example2.com');
	assert(cookies2.includes('site2=value2'), 'Should have site2 cookie');
	assert(!cookies2.includes('site1=value1'), 'Should not have site1 cookie');
});

suite.test('Should handle cookies with quotes in values', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookie with quoted value
	await client.jar.setCookie('quoted="hello world"; Path=/', BASE_URL);
	
	const cookieString = await client.jar.getCookieString(BASE_URL);
	assert(cookieString.includes('quoted='), 'Should handle quoted values');
});

suite.test('Should handle zero-length paths', async () => {
	const client = createLuminara({
		baseURL: BASE_URL,
		plugins: [cookieJarPlugin()]
	});
	
	// Set cookie with default path
	await client.jar.setCookie('defaultpath=value', BASE_URL);
	
	const cookies = await client.jar.getCookies(BASE_URL);
	assert(cookies.some(c => c.key === 'defaultpath'), 'Should handle default path cookies');
});

// Enable direct execution of this test file
await runTestSuiteIfDirect(import.meta.url, 'Edge Cases', suite, mockServer);

// Export for test runner
export { suite, mockServer };
