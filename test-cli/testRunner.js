#!/usr/bin/env node

import { Timer } from './testUtils.js';

// Import all test suites
import { suite as basicSuite, mockServer as basicServer } from './tests/basic.test.js';
import { suite as sharedJarSuite, mockServer as sharedJarServer } from './tests/sharedJar.test.js';
import { suite as attributesSuite, mockServer as attributesServer } from './tests/cookieAttributes.test.js';
import { suite as expirationSuite, mockServer as expirationServer } from './tests/expiration.test.js';
import { suite as errorSuite, mockServer as errorServer } from './tests/errorHandling.test.js';
import { suite as edgeCasesSuite, mockServer as edgeCasesServer } from './tests/edgeCases.test.js';

// Test suite registry
const TEST_SUITES = [
	{ name: 'Basic Cookie Operations', suite: basicSuite, server: basicServer },
	{ name: 'Shared Cookie Jar', suite: sharedJarSuite, server: sharedJarServer },
	{ name: 'Cookie Attributes', suite: attributesSuite, server: attributesServer },
	{ name: 'Cookie Expiration', suite: expirationSuite, server: expirationServer },
	{ name: 'Error Handling', suite: errorSuite, server: errorServer },
	{ name: 'Edge Cases', suite: edgeCasesSuite, server: edgeCasesServer },
];

// Colors for output
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m'
};

function colorize(text, color) {
	return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(text) {
	const line = '='.repeat(60);
	console.log(colorize(line, 'cyan'));
	console.log(colorize(`  ${text}`, 'bright'));
	console.log(colorize(line, 'cyan'));
}

function printSeparator() {
	console.log(colorize('-'.repeat(60), 'blue'));
}

async function runAllTests() {
	const overallTimer = new Timer();
	overallTimer.mark();
	
	printHeader('LUMINARA-COOKIEJAR COMPREHENSIVE TEST SUITE');
	console.log(colorize('Testing CookieJar plugin integration with Luminara\n', 'yellow'));
	
	const overallResults = {
		totalSuites: TEST_SUITES.length,
		passedSuites: 0,
		failedSuites: 0,
		totalTests: 0,
		passedTests: 0,
		failedTests: 0,
		suiteResults: []
	};
	
	// Start all mock servers
	console.log(colorize('🚀 Starting mock servers...', 'blue'));
	const serverPromises = TEST_SUITES.map(async ({ server }) => {
		await server.start();

		// Set baseUrl after server starts
		server.baseUrl = `http://localhost:${server.port}`;

		return server;
	});
	await Promise.all(serverPromises);
	console.log(colorize('✅ All mock servers started\n', 'green'));
	
	try {

		// Run each test suite
		for (const { name, suite, server } of TEST_SUITES) {
			printSeparator();
			console.log(colorize(`\n📋 Running: ${name}`, 'magenta'));
			console.log(colorize(`   Server: http://localhost:${server.port}`, 'blue'));
			
			const suiteTimer = new Timer();
			suiteTimer.mark();
			
			try {
				const results = await suite.run();
				suiteTimer.mark();
				
				const duration = suiteTimer.getDuration();
				const status = results.failed === 0 ? 'PASSED' : 'FAILED';
				const statusColor = results.failed === 0 ? 'green' : 'red';
				
				console.log(colorize(`   ✓ ${results.passed} passed, ✗ ${results.failed} failed`, 
					results.failed === 0 ? 'green' : 'yellow'));
				console.log(colorize(`   Duration: ${duration}ms`, 'blue'));
				console.log(colorize(`   Status: ${status}`, statusColor));
				
				// Update overall results
				overallResults.totalTests += results.total;
				overallResults.passedTests += results.passed;
				overallResults.failedTests += results.failed;
				
				if (results.failed === 0) {
					overallResults.passedSuites++;
				} else {
					overallResults.failedSuites++;
				}
				
				overallResults.suiteResults.push({
					name,
					...results,
					duration,
					status
				});
			} catch (error) {
				suiteTimer.mark();
				console.log(colorize(`   ❌ Suite failed to run: ${error.message}`, 'red'));
				overallResults.failedSuites++;
				overallResults.suiteResults.push({
					name,
					passed: 0,
					failed: 1,
					total: 1,
					duration: suiteTimer.getDuration(),
					status: 'ERROR',
					error: error.message
				});
			}
		}
	} finally {

		// Stop all mock servers
		console.log(colorize('\n🛑 Stopping mock servers...', 'blue'));
		const stopPromises = TEST_SUITES.map(({ server }) => server.stop());
		await Promise.all(stopPromises);
		console.log(colorize('✅ All mock servers stopped', 'green'));
	}
	
	overallTimer.mark();
	const totalDuration = overallTimer.getDuration();
	
	// Print final results
	printSeparator();
	printHeader('TEST RESULTS SUMMARY');
	
	console.log(colorize('\n📊 Overall Statistics:', 'bright'));
	console.log(`   Total Suites: ${overallResults.totalSuites}`);
	console.log(colorize(`   Passed Suites: ${overallResults.passedSuites}`, 'green'));
	console.log(colorize(`   Failed Suites: ${overallResults.failedSuites}`, 
		overallResults.failedSuites > 0 ? 'red' : 'green'));
	console.log(`   Total Tests: ${overallResults.totalTests}`);
	console.log(colorize(`   Passed Tests: ${overallResults.passedTests}`, 'green'));
	console.log(colorize(`   Failed Tests: ${overallResults.failedTests}`, 
		overallResults.failedTests > 0 ? 'red' : 'green'));
	console.log(colorize(`   Total Duration: ${totalDuration}ms`, 'blue'));
	
	// Success rate
	const suiteSuccessRate = ((overallResults.passedSuites / overallResults.totalSuites) * 100).toFixed(1);
	const testSuccessRate = ((overallResults.passedTests / overallResults.totalTests) * 100).toFixed(1);
	
	console.log(colorize('\n📈 Success Rates:', 'bright'));
	console.log(colorize(`   Suite Success Rate: ${suiteSuccessRate}%`, 
		suiteSuccessRate === '100.0' ? 'green' : 'yellow'));
	console.log(colorize(`   Test Success Rate: ${testSuccessRate}%`, 
		testSuccessRate === '100.0' ? 'green' : 'yellow'));
	
	// Detailed suite results
	console.log(colorize('\n📋 Suite Details:', 'bright'));
	overallResults.suiteResults.forEach((result, index) => {
		const statusIcon = result.status === 'PASSED' ? '✅' : 
		                  result.status === 'FAILED' ? '❌' : '⚠️';
		const statusColor = result.status === 'PASSED' ? 'green' : 'red';
		
		console.log(`   ${index + 1}. ${statusIcon} ${result.name}`);
		console.log(colorize(`      Status: ${result.status}`, statusColor));
		console.log(`      Tests: ${result.passed}/${result.total} passed`);
		console.log(`      Duration: ${result.duration}ms`);
		
		if (result.error) {
			console.log(colorize(`      Error: ${result.error}`, 'red'));
		}
	});
	
	// Final status
	const overallSuccess = overallResults.failedSuites === 0 && overallResults.failedTests === 0;
	const finalStatus = overallSuccess ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED';
	const finalColor = overallSuccess ? 'green' : 'red';
	
	printSeparator();
	console.log(colorize(`🎯 ${finalStatus}`, finalColor));
	
	if (overallSuccess) {
		console.log(colorize('🎉 CookieJar plugin is working perfectly with Luminara!', 'green'));
	} else {
		console.log(colorize('⚠️  Some issues detected. Please review failed tests.', 'yellow'));
	}
	
	printSeparator();
	
	// Exit with appropriate code
	process.exit(overallSuccess ? 0 : 1);
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
	console.log(colorize('Luminara-CookieJar Test Runner', 'bright'));
	console.log('\nUsage: node testRunner.js [options]');
	console.log('\nOptions:');
	console.log('  --help, -h     Show this help message');
	console.log('  --version, -v  Show version information');
	console.log('\nThis runner executes all CookieJar plugin test suites and provides');
	console.log('comprehensive validation of cookie management integration.');
	process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
	console.log('Luminara-CookieJar Test Runner v1.0.0');
	console.log('Testing CookieJar plugin for Luminara');
	process.exit(0);
}

// Run all tests
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
	await runAllTests();
}
