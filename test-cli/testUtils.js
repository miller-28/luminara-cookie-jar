import chalk from 'chalk';

// Global console message suppression for test environment
let consoleSuppression = null;

// Global function to suppress redundant console messages during testing
export function enableConsoleSuppressionForTesting() {
	if (consoleSuppression) {
		return;
	} // Already enabled
	
	const originalConsoleWarn = console.warn;
	const originalConsoleError = console.error;
	const originalConsoleLog = console.log;
	const originalProcessStderrWrite = process.stderr.write;
	const originalProcessStdoutWrite = process.stdout.write;
	
	// Messages that are expected during testing but not useful for test output
	const suppressedMessages = [
		'Response body already consumed, cannot parse JSON',
		'Body is unusable',
		'Body has already been consumed',
		'Failed to parse response as JSON',

		// Test debug output patterns
		'🔑 onRequest called with attempt:',
		'🔑 Set authorization header:',
		'🌐 Fetch call',
		'🌐 Fetch returning',
		'💥 onResponseError called with attempt:',
		'onResponse called with context.res:',
		'Final transformedResponse:',
		'[API]', // React simulation debug logs
		'[CookieJar]' // CookieJar plugin debug logs
	];
	
	// Helper function to check if message should be suppressed
	const shouldSuppress = (message) => {
		return suppressedMessages.some(suppressed => message.includes(suppressed));
	};
	
	// Suppress specific console outputs that are expected during error testing
	console.warn = (...args) => {
		const message = args.join(' ');
		if (!shouldSuppress(message)) {
			originalConsoleWarn(...args);
		}
	};
	
	console.error = (...args) => {
		const message = args.join(' ');
		if (!shouldSuppress(message)) {
			originalConsoleError(...args);
		}
	};
	
	console.log = (...args) => {
		const message = args.join(' ');
		if (!shouldSuppress(message)) {
			originalConsoleLog(...args);
		}
	};
	
	// Intercept stderr and stdout writes to catch low-level messages
	process.stderr.write = function(chunk, encoding, callback) {
		const message = chunk.toString();
		if (!shouldSuppress(message)) {
			return originalProcessStderrWrite.call(this, chunk, encoding, callback);
		}

		// Suppress the message by not writing it
		if (typeof callback === 'function') {
			callback();
		}

		return true;
	};
	
	process.stdout.write = function(chunk, encoding, callback) {
		const message = chunk.toString();
		if (!shouldSuppress(message)) {
			return originalProcessStdoutWrite.call(this, chunk, encoding, callback);
		}

		// Suppress the message by not writing it
		if (typeof callback === 'function') {
			callback();
		}

		return true;
	};
	
	consoleSuppression = {
		originalConsoleWarn,
		originalConsoleError,
		originalConsoleLog,
		originalProcessStderrWrite,
		originalProcessStdoutWrite
	};
}

// Function to restore original console methods
export function disableConsoleSuppressionForTesting() {
	if (!consoleSuppression) {
		return;
	} // Not enabled
	
	console.warn = consoleSuppression.originalConsoleWarn;
	console.error = consoleSuppression.originalConsoleError;
	console.log = consoleSuppression.originalConsoleLog;
	process.stderr.write = consoleSuppression.originalProcessStderrWrite;
	process.stdout.write = consoleSuppression.originalProcessStdoutWrite;
	
	consoleSuppression = null;
}

// Test utilities for CookieJar plugin testing environment
export class TestSuite {
	
	constructor(name) {
		this.name = name;
		this.tests = [];
		this.passed = 0;
		this.failed = 0;
		this.startTime = null;
	}

	test(description, testFn) {
		this.tests.push({ description, testFn });
	}

	async run() {
		console.log(chalk.blue.bold(`\n🧪 Running ${this.name}`));
		console.log(chalk.gray('='.repeat(50)));
		
		// Enable console suppression for testing environment
		enableConsoleSuppressionForTesting();
		
		this.startTime = Date.now();
		
		for (const { description, testFn } of this.tests) {
			const testStart = Date.now();
			try {
				await testFn();
				const duration = Date.now() - testStart;
				
				console.log(chalk.green(`  ✅ ${description}`) + chalk.gray(` (${duration}ms)`));
				this.passed++;
			} catch (error) {
				const duration = Date.now() - testStart;
				console.log(chalk.red(`  ❌ ${description}`) + chalk.gray(` (${duration}ms)`));
				console.log(chalk.red(`     ${error.message}`));
				if (process.env.VERBOSE) {
					console.log(chalk.gray(`     ${error.stack}`));
				}
				this.failed++;
			}
		}
		
		const totalTime = Date.now() - this.startTime;
		const total = this.passed + this.failed;
		
		console.log(chalk.gray('-'.repeat(50)));
		console.log(chalk.cyan(`  📊 ${this.passed}/${total} passed`) + chalk.gray(` (${totalTime}ms)`));
		
		if (this.failed > 0) {
			console.log(chalk.red(`  💥 ${this.failed} failed`));
		}
		
		// Disable console suppression after tests complete
		disableConsoleSuppressionForTesting();
		
		return { passed: this.passed, failed: this.failed, total };
	}

}

export class MockServer {

	constructor(port = 4200) {
		this.port = port;
		this.server = null;
		this.requestCounts = new Map();
		this.cookieStore = new Map(); // Track cookies set on "server side"
	}

	async start() {
		const { createServer } = await import('http');
		
		this.server = createServer(async (req, res) => {

			// CORS headers
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
			res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, X-Custom-Header');
			res.setHeader('Access-Control-Allow-Credentials', 'true');
			
			if (req.method === 'OPTIONS') {
				res.writeHead(200);
				res.end();

				return;
			}
			
			// Simulate realistic API latency (50-150ms)
			const baseLatency = 50 + Math.random() * 100;
			await new Promise(resolve => setTimeout(resolve, baseLatency));
			
			const url = new URL(req.url, `http://localhost:${this.port}`);
			const path = url.pathname;
			
			// Track request counts
			const countKey = `${req.method}:${path}`;
			this.requestCounts.set(countKey, (this.requestCounts.get(countKey) || 0) + 1);
			
			this.handleRequest(req, res, path, url.searchParams, url);
		});
		
		return new Promise((resolve) => {
			this.server.listen(this.port, () => {
				console.log(chalk.yellow(`🔧 Mock server started on port ${this.port}`));
				resolve();
			});
		});
	}

	handleRequest(req, res, path, params, url) {

		// Delay simulation
		const delay = parseInt(params.get('delay') || '0');
		const shouldFail = params.get('fail') === 'true';
		const status = parseInt(params.get('status') || '200');
		
		setTimeout(() => {
			if (shouldFail || status >= 400) {
				res.writeHead(status, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ 
					error: 'Simulated error',
					status,
					path,
					method: req.method 
				}));

				return;
			}
			
			// Success responses
			switch (path) {
				case '/set-cookie':
					// Set various types of cookies
					res.writeHead(200, {
						'Content-Type': 'application/json',
						'Set-Cookie': [
							'session=abc123; Path=/; HttpOnly',
							'user_id=12345; Path=/; Max-Age=3600',
							'preferences=theme:dark; Path=/; Secure'
						]
					});
					res.end(JSON.stringify({ 
						message: 'Cookies set',
						count: 3
					}));
					break;
					
				case '/echo-cookies':
					// Echo back cookies sent by client
					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ 
						message: 'Cookies received',
						cookies: req.headers.cookie || 'none',
						method: req.method
					}));
					break;
					
				case '/json':
					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ 
						message: 'Success',
						method: req.method,
						timestamp: new Date().toISOString(),
						requestCount: this.requestCounts.get(`${req.method}:${path}`)
					}));
					break;
					
				case '/protected':
					// Check for auth cookie
					const cookies = req.headers.cookie || '';
					const hasAuth = cookies.includes('auth_token=');
					
					if (!hasAuth) {
						res.writeHead(401, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ 
							error: 'Unauthorized',
							message: 'Missing auth token'
						}));
					} else {
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ 
							message: 'Access granted',
							cookies
						}));
					}
					break;
					
				case '/set-custom-cookie':
					// Set custom cookie from query params
					const customName = url.searchParams.get('name') || 'custom';
					const customValue = url.searchParams.get('value') || 'value';
					res.writeHead(200, {
						'Content-Type': 'application/json',
						'Set-Cookie': `${customName}=${customValue}; Path=/`
					});
					res.end(JSON.stringify({ message: 'Custom cookie set' }));
					break;
					
				case '/set-expiring-cookie':
					// Set cookie that expires in 1 hour
					const expireDate = new Date(Date.now() + 3600000).toUTCString();
					res.writeHead(200, {
						'Content-Type': 'application/json',
						'Set-Cookie': `expiring=value; Path=/; Expires=${expireDate}`
					});
					res.end(JSON.stringify({ message: 'Expiring cookie set' }));
					break;
					
				case '/delete-cookie':
					// Delete cookie by setting Max-Age=0
					res.writeHead(200, {
						'Content-Type': 'application/json',
						'Set-Cookie': 'deleteme=; Path=/; Max-Age=0'
					});
					res.end(JSON.stringify({ message: 'Cookie deleted' }));
					break;
					
				case '/set-malformed-cookie':
					// Send malformed cookie (missing value)
					res.writeHead(200, {
						'Content-Type': 'application/json',
						'Set-Cookie': 'malformed'
					});
					res.end(JSON.stringify({ message: 'Malformed cookie sent' }));
					break;
					
				case '/no-cookies':
					// Response with no Set-Cookie headers
					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({ message: 'No cookies here' }));
					break;
					
				case '/slow-response':
					// Slow response (5 seconds) for timeout tests
					setTimeout(() => {
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ message: 'Slow response' }));
					}, 5000);
					return; // Don't execute after setTimeout
					
				case '/timeout':
					// Never responds (for timeout tests)
					// Just leave it hanging
					return;
					
				default:
					// Handle dynamic paths like /admin/echo-cookies and /api/test
					if (path.endsWith('/echo-cookies')) {
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ 
							message: 'Cookies received',
							cookies: req.headers.cookie || 'none',
							path: path
						}));
					} else {
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ 
							message: 'Default response',
							path,
							method: req.method,
							cookies: req.headers.cookie || 'none'
						}));
					}
			}
		}, delay);
	}

	getRequestCount(method, path) {
		return this.requestCounts.get(`${method}:${path}`) || 0;
	}

	resetCounts() {
		this.requestCounts.clear();
	}

	async stop() {
		if (this.server) {
			return new Promise((resolve) => {
				this.server.close(() => {
					console.log(chalk.yellow('🔧 Mock server stopped'));
					resolve();
				});
			});
		}
	}

}

export function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

export function assertEqual(actual, expected, message) {

	// Handle array comparison
	if (Array.isArray(actual) && Array.isArray(expected)) {
		if (actual.length !== expected.length) {
			throw new Error(message || `Expected array length ${expected.length}, got ${actual.length}`);
		}
		for (let i = 0; i < actual.length; i++) {
			if (actual[i] !== expected[i]) {
				throw new Error(message || `Expected array[${i}] to be ${expected[i]}, got ${actual[i]}`);
			}
		}

		return;
	}
	
	// Handle primitive comparison
	if (actual !== expected) {
		throw new Error(message || `Expected ${expected}, got ${actual}`);
	}
}

export function assertRange(value, min, max, message) {
	if (value < min || value > max) {
		throw new Error(message || `Expected ${value} to be between ${min} and ${max}`);
	}
}

export async function assertThrows(fn, expectedErrorCode, message) {
	try {
		await fn();
		throw new Error(`${message || 'Expected error but none was thrown'}`);
	} catch (error) {
		if (!expectedErrorCode) {
			// Just verify that an error was thrown
			return;
		}
		
		// Verify specific error code
		if (error.code !== expectedErrorCode) {
			throw new Error(
				`${message || 'Error code mismatch'} - Expected ${expectedErrorCode}, got ${error.code || error.message}`
			);
		}
	}
}

export async function assertEventuallyTrue(condition, timeout = 5000, message) {
	return new Promise((resolve, reject) => {
		const start = Date.now();
		const interval = setInterval(() => {
			try {
				if (condition()) {
					clearInterval(interval);
					resolve();
				} else if (Date.now() - start > timeout) {
					clearInterval(interval);
					reject(new Error(`${message || 'Condition not met'} - Timeout after ${timeout}ms`));
				}
			} catch (error) {
				clearInterval(interval);
				reject(error);
			}
		}, 100);
	});
}

export async function measureTime(fn) {
	const start = Date.now();
	const result = await fn();
	const duration = Date.now() - start;

	return { result, duration };
}

export function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export class Timer {

	constructor() {
		this.times = [];
	}

	mark() {
		this.times.push(Date.now());
	}

	getDuration(from = 0, to = -1) {
		const startTime = this.times[from];
		const endTime = to === -1 ? this.times[this.times.length - 1] : this.times[to];

		return endTime - startTime;
	}

	getDurations() {
		const durations = [];
		for (let i = 1; i < this.times.length; i++) {
			durations.push(this.times[i] - this.times[i - 1]);
		}

		return durations;
	}

	reset() {
		this.times = [];
	}

}
