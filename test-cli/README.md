# Luminara-CookieJar Testing Environment

Comprehensive test suite for the Luminara CookieJar plugin using a proven testing framework.

## 🧪 Test Structure

```
test-cli/
├── package.json           # Test environment dependencies
├── testRunner.js          # Main test orchestrator
├── testUtils.js           # Shared testing utilities (TestSuite, MockServer, assertions)
├── runTestSuite.js        # Helper for running individual test files
└── tests/                 # Individual test suites
    └── (test files go here)
```

## 📦 Installation

```powershell
cd test-cli
npm install
```

## 🚀 Running Tests

### Run All Tests
```powershell
npm test
```

### Run Individual Test Suite
```powershell
node tests/specificTest.test.js
```

## 🛠️ Test Infrastructure

### TestSuite Class
Main test organization class with:
- `test(description, testFn)` - Register a test
- `async run()` - Execute all tests with timing and reporting
- Automatic console suppression for clean output
- Color-coded results using chalk

### MockServer Class
HTTP test server with:
- Configurable port (default: 4200)
- CORS support with credentials
- Cookie management endpoints:
  - `/set-cookie` - Sets multiple test cookies
  - `/echo-cookies` - Echoes received cookies
  - `/protected` - Requires auth cookie
  - `/json` - Standard JSON response
- Request counting and tracking
- Simulated realistic API latency (50-150ms)

### Assertion Utilities
- `assert(condition, message)` - Basic assertion
- `assertEqual(actual, expected, message)` - Value comparison with array support
- `assertRange(value, min, max, message)` - Range validation
- `assertThrows(fn, expectedErrorCode, message)` - Error testing
- `assertEventuallyTrue(condition, timeout, message)` - Async condition waiting
- `measureTime(fn)` - Performance measurement
- `sleep(ms)` - Async delay helper

### Timer Class
Performance measurement tool:
- `mark()` - Record timestamp
- `getDuration(from, to)` - Calculate duration between marks
- `getDurations()` - Get all intervals
- `reset()` - Clear all marks

## 📝 Writing Tests

### Example Test File

```javascript
import { TestSuite, MockServer, assert, assertEqual } from '../testUtils.js';
import { runTestSuiteIfDirect } from '../runTestSuite.js';
import { createLuminara } from 'luminara';
import { cookieJarPlugin } from '../../dist/index.cjs';

// Create test suite and mock server
const suite = new TestSuite('Cookie Management Tests');
const mockServer = new MockServer(4201); // Use unique port

// Add tests
suite.test('Should set and send cookies', async () => {
  const client = createLuminara({
    baseURL: mockServer.baseUrl,
    plugins: [cookieJarPlugin()]
  });
  
  // First request sets cookies
  const setResponse = await client.get('/set-cookie');
  assertEqual(setResponse.data.count, 3, 'Should set 3 cookies');
  
  // Second request should send cookies
  const echoResponse = await client.get('/echo-cookies');
  assert(echoResponse.data.cookies.includes('session=abc123'), 'Should send session cookie');
});

suite.test('Should persist cookies across requests', async () => {
  // Test implementation...
});

// Enable direct execution
await runTestSuiteIfDirect(import.meta.url, 'Cookie Management Tests', suite, mockServer);

// Export for test runner
export { suite, mockServer };
```

### Adding to Test Runner

Update `testRunner.js`:

```javascript
import { suite as cookieSuite, mockServer as cookieServer } from './tests/cookieManagement.test.js';

const TEST_SUITES = [
  { name: 'Cookie Management', suite: cookieSuite, server: cookieServer },
  // Add more test suites...
];
```

## 🎯 Test Coverage Goals

Planned test suites for CookieJar plugin:
- ✅ Basic cookie operations (set, send, persist)
- ✅ Multiple cookies handling
- ✅ Cookie attributes (Path, Domain, Secure, HttpOnly)
- ✅ Cookie expiration and Max-Age
- ✅ Cross-domain cookie isolation
- ✅ Cookie jar sharing across clients
- ✅ Integration with Luminara interceptor system
- ✅ Error handling (malformed cookies, etc.)
- ✅ Edge cases (empty jar, URL resolution without baseURL)

## 🔧 Mock Server Ports

Each test suite should use a unique port to avoid conflicts:
- 4201: Default/shared mock server
- 4202: Cookie management tests
- 4203: Cookie attributes tests
- 4204: Cross-domain tests
- 4205: Integration tests
- (Add more as needed)

## 🎨 Console Output

The test framework provides clean, color-coded output:
- ✅ Green checkmarks for passing tests
- ❌ Red X marks for failing tests
- ⏱️ Timing information for each test
- 📊 Summary statistics
- 🎯 Overall pass/fail status

Debug logging is automatically suppressed during tests to keep output clean. Use `VERBOSE=1` environment variable to see stack traces on failures.

## 🚦 Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed

Perfect for CI/CD integration.

## 📚 Best Practices

1. **Unique Ports**: Always use a unique port for each test suite's mock server
2. **Descriptive Names**: Use clear, descriptive test names
3. **Generous Tolerances**: Use ±300ms tolerances for timing tests
4. **Clean Mocks**: Reset mock server state between tests if needed
5. **Error Testing**: Always test error scenarios, not just happy paths
6. **Isolation**: Tests should be independent and not rely on execution order
7. **Direct Execution**: Enable running individual test files for faster iteration

## 🔄 Development Workflow

1. **During Development**: Run specific test file
   ```powershell
   node tests/myFeature.test.js
   ```

2. **Final Validation**: Run full test suite
   ```powershell
   npm test
   ```