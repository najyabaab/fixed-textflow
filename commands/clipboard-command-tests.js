/**
 * Test Examples for {clipboard} Command
 * 
 * This file contains comprehensive test cases for the {clipboard} command
 * with formula integration, trim support, and error handling.
 */

// ============================================
// TEST 1: Simple Clipboard Insertion
// ============================================
console.log("Test 1: Simple Clipboard Insertion");
const snippet1 = `You copied: {clipboard}`;
// Setup: Copy "Hello World" to clipboard
// Expected Output: "You copied: Hello World"

// ============================================
// TEST 2: Clipboard with Trim - Yes
// ============================================
console.log("Test 2: Clipboard with Trim Yes");
const snippet2 = `Before   {clipboard: trim=yes}   After`;
// Setup: Copy "Test" to clipboard
// Expected Output: "BeforeTestAfter"
// Whitespace removed on both sides of the command

// ============================================
// TEST 3: Clipboard with Trim - Left
// ============================================
console.log("Test 3: Clipboard with Trim Left");
const snippet3 = `Before   {clipboard: trim=left}   After`;
// Setup: Copy "Test" to clipboard
// Expected Output: "BeforeTest   After"
// Only left whitespace removed

// ============================================
// TEST 4: Clipboard with Trim - Right
// ============================================
console.log("Test 4: Clipboard with Trim Right");
const snippet4 = `Before   {clipboard: trim=right}After`;
// Setup: Copy "Test" to clipboard
// Expected Output: "Before   TestAfter"
// Only right whitespace removed

// ============================================
// TEST 5: Clipboard with Trim - No (Default)
// ============================================
console.log("Test 5: Clipboard with Trim No");
const snippet5 = `Before   {clipboard}   After`;
// Setup: Copy "Test" to clipboard
// Expected Output: "Before   Test   After"
// All whitespace preserved

// ============================================
// TEST 6: Extract Name with Regex (Capture Group)
// ============================================
console.log("Test 6: Extract Name with Regex");
const snippet6 = `Dear {= extractregex(clipboard, "Name: ([^,]+)")}`;
// Setup: Copy "Name: John Doe, Phone: 555-1234" to clipboard
// Expected Output: "Dear John Doe"
// Uses capture group to extract just the name

// ============================================
// TEST 7: Extract Phone Number
// ============================================
console.log("Test 7: Extract Phone Number");
const snippet7 = `Phone: {= extractregex(clipboard, "Phone: (\\d{3}-\\d{4})")}`;
// Setup: Copy "Name: Alice, Phone: 555-9876" to clipboard
// Expected Output: "Phone: 555-9876"

// ============================================
// TEST 8: Error Handling with catch() - No Match
// ============================================
console.log("Test 8: Error Handling - No Match");
const snippet8 = `Dear {= catch(extractregex(clipboard, "Name: ([^,]+)"), "Customer")}`;
// Setup: Copy "Phone: 555-0199" to clipboard (no name field)
// Expected Output: "Dear Customer"
// Falls back to "Customer" when name pattern doesn't match

// ============================================
// TEST 9: Error Handling with catch() - Match Found
// ============================================
console.log("Test 9: Error Handling - Match Found");
const snippet9 = `Dear {= catch(extractregex(clipboard, "Name: ([^,]+)"), "Customer")}`;
// Setup: Copy "Name: Sarah Smith, Age: 30" to clipboard
// Expected Output: "Dear Sarah Smith"
// Uses the extracted name since pattern matches

// ============================================
// TEST 10: Conditional Logic with testregex()
// ============================================
console.log("Test 10: Conditional Logic with testregex");
const snippet10 = `{if: testregex(clipboard, "@")}
Email detected: {clipboard}
{else}
Not an email: {clipboard}
{endif}`;
// Setup A: Copy "user@example.com" to clipboard
// Expected Output: "Email detected: user@example.com"
// Setup B: Copy "John Doe" to clipboard
// Expected Output: "Not an email: John Doe"

// ============================================
// TEST 11: Extract Email from Mixed Content
// ============================================
console.log("Test 11: Extract Email from Mixed Content");
const snippet11 = `Contact: {= extractregex(clipboard, "([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\\.[a-zA-Z]{2,})")}`;
// Setup: Copy "Please contact support at help@example.com for assistance" to clipboard
// Expected Output: "Contact: help@example.com"

// ============================================
// TEST 12: Multiple Extraction with Fallback
// ============================================
console.log("Test 12: Multiple Extraction with Fallback");
const snippet12 = `Name: {= catch(extractregex(clipboard, "Name: ([^,]+)"), "N/A")}
Email: {= catch(extractregex(clipboard, "([\\w.+-]+@[\\w.-]+\\.[a-zA-Z]{2,})"), "N/A")}
Phone: {= catch(extractregex(clipboard, "(\\d{3}-\\d{4})"), "N/A")}`;
// Setup: Copy "Name: Bob Johnson, Email: bob@test.com" to clipboard
// Expected Output:
// Name: Bob Johnson
// Email: bob@test.com
// Phone: N/A

// ============================================
// TEST 13: Empty Clipboard Handling
// ============================================
console.log("Test 13: Empty Clipboard");
const snippet13 = `Clipboard content: [{clipboard}]`;
// Setup: Ensure clipboard is empty
// Expected Output: "Clipboard content: []"

// ============================================
// TEST 14: Clipboard in Formula Context
// ============================================
console.log("Test 14: Clipboard in Formula Context");
const snippet14 = `Length: {= len(clipboard)} characters
Uppercase: {= upper(clipboard)}`;
// Setup: Copy "hello" to clipboard
// Expected Output:
// Length: 5 characters
// Uppercase: HELLO

// ============================================
// TEST 15: Complex Real-World Example - Contact Card
// ============================================
console.log("Test 15: Real-World Contact Card");
const snippet15 = `## Contact Information

Name: {= catch(extractregex(clipboard, "Name:\\s*([^\\n]+)"), "Unknown")}
Email: {= catch(extractregex(clipboard, "([\\w.+-]+@[\\w.-]+\\.[a-zA-Z]{2,})"), "Not provided")}
Phone: {= catch(extractregex(clipboard, "(\\d{3}-\\d{3}-\\d{4})"), "Not provided")}
Company: {= catch(extractregex(clipboard, "Company:\\s*([^\\n]+)"), "Not provided")}`;
// Setup: Copy the following to clipboard:
// """
// Name: Jane Doe
// Email: jane.doe@company.com
// Phone: 555-123-4567
// """
// Expected Output:
// ## Contact Information
//
// Name: Jane Doe
// Email: jane.doe@company.com
// Phone: 555-123-4567
// Company: Not provided

// ============================================
// TEST 16: Test Clipboard Variable Direct Access
// ============================================
console.log("Test 16: Clipboard Variable Direct Access");
const snippet16 = `{if: contains(clipboard, "urgent")}
🚨 URGENT: {clipboard}
{else}
📌 Note: {clipboard}
{endif}`;
// Setup A: Copy "This is urgent!" to clipboard
// Expected Output: "🚨 URGENT: This is urgent!"
// Setup B: Copy "Regular message" to clipboard
// Expected Output: "📌 Note: Regular message"

// ============================================
// TEST 17: Extract Multiple Capture Groups (First Group Only)
// ============================================
console.log("Test 17: Multiple Capture Groups");
const snippet17 = `First Name: {= extractregex(clipboard, "Name:\\s*(\\w+)\\s+(\\w+)")}`;
// Setup: Copy "Name: John Smith" to clipboard
// Expected Output: "First Name: John"
// Note: extractregex returns match[1] (first capture group)

// ============================================
// TEST 18: Clipboard with Nested catch() Functions
// ============================================
console.log("Test 18: Nested Error Handling");
const snippet18 = `{= catch(
    catch(extractregex(clipboard, "Primary: ([^,]+)"), 
          extractregex(clipboard, "Secondary: ([^,]+)")),
    "No data found"
)}`;
// Setup A: Copy "Primary: Value1" to clipboard
// Expected Output: "Value1"
// Setup B: Copy "Secondary: Value2" to clipboard
// Expected Output: "Value2"
// Setup C: Copy "Other: Value3" to clipboard
// Expected Output: "No data found"

// ============================================
// USAGE NOTES
// ============================================
/*
 * The {clipboard} command supports:
 * 
 * BASIC USAGE:
 * - {clipboard} - Insert clipboard content
 * - {clipboard: trim=yes} - Insert with whitespace trimmed
 * 
 * TRIM PARAMETER:
 * - trim=yes: Remove whitespace before AND after the command
 * - trim=no: Preserve whitespace (default)
 * - trim=left: Remove whitespace only on the left
 * - trim=right: Remove whitespace only on the right
 * 
 * FORMULA INTEGRATION:
 * - Clipboard available as 'clipboard' variable in formulas
 * - Use with extractregex(clipboard, pattern) for data extraction
 * - Use with testregex(clipboard, pattern) for conditional checks
 * - Use with catch(expression, fallback) for error handling
 * 
 * REGEX EXTRACTION:
 * - extractregex(text, pattern) returns captured group if present
 * - Returns full match if no capture group
 * - Throws error if no match found (use catch() for fallback)
 * 
 * ERROR HANDLING:
 * - catch(tryExpr, fallbackValue) returns tryExpr or fallback on error
 * - Useful when clipboard format is uncertain
 * - Can be nested for complex fallback logic
 * 
 * PERMISSIONS:
 * - Requires clipboard read permission
 * - Returns empty string if permission denied
 * - Gracefully handles permission errors
 */
