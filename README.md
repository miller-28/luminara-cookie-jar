# 🍪 luminara-cookie-jar

[![Website](https://img.shields.io/badge/Website-luminara.website-blue?style=flat-square&logo=web)](https://luminara.website)
[![GitHub](https://img.shields.io/badge/GitHub-miller--28%2Fluminara--cookie--jar-black?style=flat-square&logo=github)](https://github.com/miller-28/luminara-cookie-jar)
[![npm](https://img.shields.io/npm/v/luminara-cookie-jar?style=flat-square&logo=npm)](https://www.npmjs.com/package/luminara-cookie-jar)
[![license](https://img.shields.io/npm/l/luminara-cookie-jar.svg)](https://github.com/miller-28/luminara-cookie-jar/blob/main/LICENSE)

**CookieJar plugin for Luminara** - Automatic `Cookie` / `Set-Cookie` header management for server-side environments using [tough-cookie](https://github.com/salesforce/tough-cookie).

This plugin gives Luminara full browser-like cookie behavior in Node.js and server environments.

Perfect for Node.js, SSR applications, CLI tools, and test harnesses where cookies aren't automatically managed by the browser.

## 📦 Installation

```bash
npm install luminara luminara-cookie-jar
```

**Note:** `tough-cookie` is automatically installed as a dependency.

## 🚀 Quick Start

```javascript
import { createLuminara } from 'luminara';
import { cookieJarPlugin } from 'luminara-cookie-jar';

// Create client with cookie support
const client = createLuminara({
  baseURL: 'https://api.example.com',
  plugins: [cookieJarPlugin()]
});

// Login request sets cookies automatically
await client.post('/login', { username: 'user', password: 'pass' });

// Subsequent requests include cookies automatically
await client.get('/profile');  // Cookies sent automatically!

// Access cookie jar directly
console.log(await client.jar.getCookies('https://api.example.com'));
```

## ✨ Features

- 🔄 **Automatic Cookie Management** - Captures `Set-Cookie` and sends `Cookie` automatically
- 🌐 **Universal Compatibility** - Node.js, SSR, CLI tools, test environments
- 🔌 **Zero Configuration** - Works out of the box with safe defaults
- 🤝 **Shared Jars** - Share cookie jars across multiple clients
- 📝 **Full TypeScript Support** - Complete type definitions included
- 🎯 **Standards Compliant** - Backed by tough-cookie (RFC 6265)
- 🔒 **Cookie-Safe Merging** - Manual `Cookie` headers merge with jar cookies
- ⚡ **Minimal Dependencies** - Uses only Luminara and tough-cookie
- 🛡️ **Robust Error Handling** - Malformed cookies handled gracefully
- 🔁 **Retry Compatible** - Cookies refreshed for each retry attempt
- 🎭 **Hedging Support** - Works seamlessly with Luminara's hedging
- 📊 **Stats Integration** - Every cookie event tracked by Luminara stats

## 📖 Usage

### Installation Patterns

**Via plugins array:**
```javascript
const client = createLuminara({
  baseURL: 'https://api.example.com',
  plugins: [cookieJarPlugin()]
});
```

**Via client.use():**
```javascript
const client = createLuminara({
  baseURL: 'https://api.example.com'
});
client.use(cookieJarPlugin());
```

### Shared Cookie Jar

Share cookies across multiple client instances:

Note: Importing CookieJar directly is optional and only required for advanced shared-session scenarios.

```javascript
import { CookieJar } from 'tough-cookie';

const sharedJar = new CookieJar();

const client1 = createLuminara({
  baseURL: 'https://api.example.com',
  plugins: [cookieJarPlugin({ jar: sharedJar })]
});

const client2 = createLuminara({
  baseURL: 'https://api.example.com',
  plugins: [cookieJarPlugin({ jar: sharedJar })]
});

// client1 logs in
await client1.post('/login', credentials);

// client2 automatically has access to the session!
await client2.get('/profile');
```

### Programmatic Cookie Access

The plugin attaches the cookie jar to `client.jar`:

```javascript
const client = createLuminara({
  baseURL: 'https://api.example.com',
  plugins: [cookieJarPlugin()]
});

// Set cookies manually
await client.jar.setCookie(
  'session=abc123; Path=/; HttpOnly',
  'https://api.example.com'
);

// Get cookies for a URL
const cookies = await client.jar.getCookies('https://api.example.com');
console.log(cookies);

// Get cookie header string
const cookieString = await client.jar.getCookieString('https://api.example.com');
console.log(cookieString); // "session=abc123"

// Remove all cookies
await client.jar.removeAllCookies();
```

### Without baseURL

The plugin works with absolute URLs even without `baseURL` configuration:

```javascript
const client = createLuminara({
  plugins: [cookieJarPlugin()]
});

// Cookies are tracked per domain
await client.get('https://api.example.com/login');
await client.get('https://api.example.com/profile');  // Cookies sent
```

## 🔧 API Reference

### `cookieJarPlugin(options?)`

Creates a Luminara plugin that manages cookies automatically.

**Options:**

- `jar` (optional): `CookieJar` - Provide your own CookieJar instance to share across clients. If omitted, a new jar is created per client.

**Returns:** Luminara plugin object with hooks:
- `onAttach(client)` - Attaches jar to `client.jar`
- `onRequest(context)` - Injects cookies into requests
- `onResponse(context)` - Captures Set-Cookie headers

### `client.jar` API

Once the plugin is registered, `client.jar` exposes the full tough-cookie CookieJar API:

```javascript
// Get all cookies for a URL
const cookies = await client.jar.getCookies(url);
// Returns: Array of Cookie objects

// Get cookie string for request
const cookieString = await client.jar.getCookieString(url);
// Returns: "name1=value1; name2=value2"

// Set a cookie manually
await client.jar.setCookie(cookieString, url);
// Example: 'session=abc; Path=/; HttpOnly'

// Set a Cookie object
await client.jar.setCookie(cookieObject, url);

// Remove all cookies
await client.jar.removeAllCookies();

// Get cookie count
const count = await client.jar.getCookies(url).then(c => c.length);

// Access jar directly
const jar = client.jar; // This is the CookieJar instance
```

See [tough-cookie documentation](https://github.com/salesforce/tough-cookie) for complete CookieJar API.

### Plugin Behavior

**On Request (via `onRequest` hook):**
1. Reads cookies from jar for the request URL (respects domain, path, secure flags)
2. Merges with any existing `Cookie` header (preserves manual cookies)
3. Adds combined `Cookie` header to outgoing request
4. Works on every retry attempt (cookies refreshed each time)

**On Response (via `onResponse` hook):**
1. Extracts all `Set-Cookie` headers using `Headers.getSetCookie()` (Node.js 18+)
2. Stores cookies in jar with proper domain/path scoping
3. Respects expiration, Max-Age, secure, httpOnly, sameSite attributes
4. Handles multiple cookies with same name but different paths/domains
5. Gracefully handles malformed cookies (logs warning, continues request)

**Client Attachment (via `onAttach` hook):**
- Plugin attaches jar to `client.jar` during registration
- Available whether plugin added via constructor or `.use()`
- Exposes full tough-cookie CookieJar API
- Shared jars accessible from all clients using the same instance

## 🧪 Testing

The plugin includes a comprehensive test suite with **50+ tests** across 6 test categories:

### Test Suites

- **Basic Cookie Operations** (7 tests) - Core functionality, cookie setting/sending, client.use() pattern
- **Shared Cookie Jar** (5 tests) - Jar sharing between clients, synchronization, concurrent operations
- **Cookie Attributes** (9 tests) - HttpOnly, Secure, Path, Domain, Max-Age, Expires, SameSite
- **Cookie Expiration** (8 tests) - Expiration handling, Max-Age=0, session cookies, cookie updates
- **Error Handling** (11 tests) - Malformed cookies, network errors, retries, timeouts, aborts
- **Edge Cases** (13 tests) - Special characters, long values, multiple domains, empty values

### Running Tests

```bash
# Install dependencies
npm install
cd test-cli
npm install

# Run all test suites (recommended)
npm test

# Run specific test suite
npm run test:basic       # Basic operations
npm run test:shared      # Shared jar tests
npm run test:attributes  # Cookie attributes
npm run test:expiration  # Expiration handling
npm run test:errors      # Error handling
npm run test:edge        # Edge cases
```

### Test Results

All tests use Luminara's proven testing framework with dedicated mock servers on unique ports (4201-4206) to prevent conflicts. Tests cover:

✅ Cookie injection on requests  
✅ Set-Cookie capture from responses  
✅ Cookie persistence across requests  
✅ Domain and path scoping  
✅ Expiration and Max-Age handling  
✅ Shared jar synchronization  
✅ Error recovery and graceful degradation  
✅ Integration with retry/hedging/stats

## 📋 Use Cases

- **API Testing** - Maintain session state across test requests
- **SSR Applications** - Handle cookies in server-side rendered apps
- **CLI Tools** - Authenticate and maintain sessions in command-line tools
- **Web Scraping** - Manage cookies when crawling websites
- **Microservices** - Service-to-service communication with cookie-based auth
- **Test Harnesses** - Automated testing of cookie-based authentication flows

## 🤝 Integration with Luminara

This plugin integrates seamlessly with Luminara's enhanced interceptor system:

- ✅ Supports retry logic (cookies refreshed on each attempt)
- ✅ Works with request hedging
- ✅ Compatible with all Luminara features
- ✅ Respects abort signals and timeouts
- ✅ Full stats integration

## 📚 Luminara Integration Example

```javascript
import { createLuminara } from 'luminara';
import { cookieJarPlugin } from 'luminara-cookie-jar';

const api = createLuminara({
  baseURL: 'https://api.example.com',
  retry: 3,
  timeout: 5000,
  plugins: [
    cookieJarPlugin(),
    {
      name: 'auth-refresh',
      async onResponseError(context) {
        if (context.error.status === 401) {
          // Refresh token and retry
          await refreshAuthToken(context.client);
          throw context.error; // Trigger retry
        }
      }
    }
  ]
});

// Cookies persist across retries automatically
const response = await api.get('/protected-resource');
```

## 🔒 Security Considerations

- **HttpOnly cookies**: Fully supported and respected
- **Secure cookies**: Only sent over HTTPS
- **Domain/Path scoping**: Enforced by tough-cookie
- **Cookie expiration**: Expiration is fully enforced by tough-cookie
- **Same-site policies**: Respected according to RFC 6265

## 📄 License

MIT © 2025 [Jonathan Miller](mailto:jonathan@miller28.com) • [LinkedIn](https://www.linkedin.com/in/miller28/)

## 🪐 Philosophy

**Luminara** — derived from "lumen" (light) — symbolizes clarity and adaptability.

Like light traveling through space, Luminara guides your HTTP requests with grace, reliability, and cosmic precision across all JavaScript environments. Built with mindfulness for developers who craft with intention.

**Simple by Design** • **Developer-Friendly** •
