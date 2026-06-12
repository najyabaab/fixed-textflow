/**
 * Test Examples for {wait} Command
 * 
 * This file contains comprehensive test cases for the enhanced {wait} command.
 */

// ============================================
// TEST 1: Default Delay (1 second)
// ============================================
console.log("Test 1: Default Delay");
const snippet1 = `
Before wait{wait}After wait
`;
// Expected: Pauses for 1000ms (1 second) between "Before wait" and "After wait"


// ============================================
// TEST 2: Seconds Format
// ============================================
console.log("Test 2: Seconds Format");
const snippet2 = `
{wait: 2s}
`;
// Expected: Pauses for 2000ms (2 seconds)


// ============================================
// TEST 3: Milliseconds Format
// ============================================
console.log("Test 3: Milliseconds Format");
const snippet3 = `
{wait: 500ms}
`;
// Expected: Pauses for 500ms


// ============================================
// TEST 4: Backward Compatibility (raw milliseconds)
// ============================================
console.log("Test 4: Backward Compatibility");
const snippet4 = `
{wait: 3000}
`;
// Expected: Pauses for 3000ms (3 seconds)


// ============================================
// TEST 5: Trim Whitespace - Yes
// ============================================
console.log("Test 5: Trim Whitespace - Yes");
const snippet5 = `
Text before   {wait: 1s; trim=yes}   text after
`;
// Expected: "Text beforetext after" with whitespace removed before and after {wait}
// Pause for 1 second between them


// ============================================
// TEST 6: Trim Whitespace - Left
// ============================================
console.log("Test 6: Trim Whitespace - Left");
const snippet6 = `
Text before   {wait: 1s; trim=left}   text after
`;
// Expected: "Text before   text after" with whitespace removed only on the left
// Pause for 1 second


// ============================================
// TEST 7: Trim Whitespace - Right
// ============================================
console.log("Test 7: Trim Whitespace - Right");
const snippet7 = `
Text before   {wait: 1s; trim=right}text after
`;
// Expected: "Text before   text after" with whitespace removed only on the right
// Pause for 1 second


// ============================================
// TEST 8: Autopilot Scenario (Full Form Automation)
// ============================================
console.log("Test 8: Autopilot Scenario");
const snippet8 = `
{key: tab}
{key: enter}
{wait: 2s}
{key: tab}
`;
// Expected Flow:
// 1. Tab to a button
// 2. Press Enter (triggers form submission or page load)
// 3. Wait 2 seconds for page to finish loading
// 4. Tab to the next field in the newly loaded form section


// ============================================
// TEST 9: Minutes Format
// ============================================
console.log("Test 9: Minutes Format");
const snippet9 = `
{wait: 1m}
`;
// Expected: Pauses for 60000ms (1 minute)


// ============================================
// TEST 10: Hours Format
// ============================================
console.log("Test 10: Hours Format");
const snippet10 = `
{wait: 1h}
`;
// Expected: Pauses for 3600000ms (1 hour)


// ============================================
// TEST 11: Decimal Values
// ============================================
console.log("Test 11: Decimal Values");
const snippet11 = `
{wait: 1.5s}
`;
// Expected: Pauses for 1500ms (1.5 seconds)


// ============================================
// TEST 12: Element Selector Fallback
// ============================================
console.log("Test 12: Element Selector Fallback");
const snippet12 = `
{click: #load-button}
{wait: .results-container}
{site: .result-count}
`;
// Expected: 
// 1. Click the load button
// 2. Wait until .results-container element appears
// 3. Extract data from .result-count


// ============================================
// TEST 13: Complex Autopilot with Multiple Waits
// ============================================
console.log("Test 13: Complex Autopilot");
const snippet13 = `
{textfield: name=Email}
{key: tab}
{textfield: name=Password}
{key: tab}
{key: enter}
{wait: 2s}
{site: .welcome-message}
`;
// Expected:
// 1. User fills email field
// 2. Tab to password field
// 3. User fills password field
// 4. Tab forward
// 5. Press Enter to submit login form
// 6. Wait 2 seconds for redirect and page load
// 7. Extract welcome message from loaded page


// ============================================
// USAGE NOTES
// ============================================
/*
 * The {wait} command supports:
 * 
 * DELAY FORMATS:
 * - No argument: {wait} → defaults to 1s (1000ms)
 * - Seconds: {wait: 10s} → 10000ms
 * - Milliseconds: {wait: 500ms} → 500ms
 * - Minutes: {wait: 2m} → 120000ms
 * - Hours: {wait: 1h} → 3600000ms
 * - Raw numbers: {wait: 3000} → 3000ms (backward compatible)
 * - Decimals: {wait: 1.5s} → 1500ms
 * 
 * TRIM PARAMETER:
 * - trim=yes: Remove whitespace before AND after the command
 * - trim=no: Preserve whitespace (default)
 * - trim=left: Remove whitespace only on the left
 * - trim=right: Remove whitespace only on the right
 * 
 * AUTOPILOT USE CASE:
 * The {wait} command is essential for Autopilot scripts where you need to:
 * 1. Trigger a web page change (e.g., form submission)
 * 2. Wait for the page to load or render new elements
 * 3. Continue with the next automation steps
 * 
 * The execution is SYNCHRONOUS - subsequent commands will NOT execute
 * until the wait period completes.
 */
