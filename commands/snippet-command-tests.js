/**
 * Test Examples for {snippet} Command
 * 
 * This file contains comprehensive test cases for the snippet introspection command.
 * The {snippet} command allows snippets to access their own metadata during execution.
 */

// ============================================
// TEST 1: Basic ID Retrieval
// ============================================
console.log("Test 1: Basic ID Retrieval");
const snippet1 = `Snippet ID: {snippet: id}`;
// Expected Output: "Snippet ID: [unique-id-string]"
// Example: "Snippet ID: 1736269200000-x7k9m2p4q"

// ============================================
// TEST 2: Shortcut Retrieval
// ============================================
console.log("Test 2: Shortcut Retrieval");
const snippet2 = `You triggered: {snippet: shortcut}`;
// Setup: Create snippet with shortcut "/sig"
// Expected Output: "You triggered: /sig"

// ============================================
// TEST 3: Trigger Case-Sensitivity - Lowercase
// ============================================
console.log("Test 3: Trigger Case-Sensitivity - Lowercase");
const snippet3 = `You typed: {snippet: trigger}`;
// Setup: Create snippet with shortcut "/test"
// User types: /test (lowercase)
// Expected Output: "You typed: /test"

// ============================================
// TEST 4: Trigger Case-Sensitivity - Uppercase
// ============================================
console.log("Test 4: Trigger Case-Sensitivity - Uppercase");
const snippet4 = `You typed: {snippet: trigger}`;
// Setup: Create snippet with shortcut "/test"
// User types: /TEST (uppercase)
// Expected Output: "You typed: /TEST"
// NOTE: The trigger preserves exact case as typed

// ============================================
// TEST 5: Trigger Case-Sensitivity - Mixed Case
// ============================================
console.log("Test 5: Trigger Case-Sensitivity - Mixed Case");
const snippet5 = `You typed: {snippet: trigger}`;
// Setup: Create snippet with shortcut "/test"
// User types: /TeSt (mixed case)
// Expected Output: "You typed: /TeSt"

// ============================================
// TEST 6: Property Name Validation - Uppercase Invalid
// ============================================
console.log("Test 6: Property Name Validation - Uppercase Invalid");
const snippet6 = `ID uppercase: [{snippet: ID}] vs lowercase: [{snippet: id}]`;
// Expected Output: "ID uppercase: [] vs lowercase: [actual-id]"
// Uppercase property names return empty string

// ============================================
// TEST  7: Property Name Validation - Mixed Case Invalid
// ============================================
console.log("Test 7: Property Name Validation - Mixed Case");
const snippet7 = `{snippet: Shortcut} should be empty, {snippet: shortcut} should work`;
// Expected Output: " should be empty, /test should work"

// ============================================
// TEST 8: Name Property (Backwards Compatibility)
// ============================================
console.log("Test 8: Name Property");
const snippet8 = `Snippet name: {snippet: name}`;
// Setup: Create snippet with name "Email Signature"
// Expected Output: "Snippet name: Email Signature"

// ============================================
// TEST 9: Trim Parameter - Yes
// ============================================
console.log("Test 9: Trim Parameter - Yes");
const snippet9 = `Before   {snippet: shortcut; trim=yes}   After`;
// Setup: Snippet shortcut is "/test"
// Expected Output: "Before/testAfter"
// Whitespace removed on both sides

// ============================================
// TEST 10: Trim Parameter - Left
// ============================================
console.log("Test 10: Trim Parameter - Left");
const snippet10 = `Before   {snippet: shortcut; trim=left}   After`;
// Setup: Snippet shortcut is "/test"
// Expected Output: "Before/test   After"
// Only left whitespace removed

// ============================================
// TEST 11: Trim Parameter - Right
// ============================================
console.log("Test 11: Trim Parameter - Right");
const snippet11 = `Before   {snippet: shortcut; trim=right}After`;
// Setup: Snippet shortcut is "/test"
// Expected Output: "Before   /testAfter"
// Only right whitespace removed

// ============================================
// TEST 12: Trim Parameter - No (Default)
// ============================================
console.log("Test 12: Trim Parameter - No");
const snippet12 = `Before   {snippet: shortcut}   After`;
// Setup: Snippet shortcut is "/test"
// Expected Output: "Before   /test   After"
// All whitespace preserved

// ============================================
// TEST 13: Import Inheritance - Basic
// ============================================
console.log("Test 13: Import Inheritance - Basic");
// Create two snippets:
const parentSnippet = `{import: /child}`;
const childSnippet = `Parent shortcut from child: {snippet: shortcut}`;
// Setup: 
// - Parent has shortcut "/parent"
// - Child has shortcut "/child"
// User types: /parent
// Expected Output: "Parent shortcut from child: /parent"
// NOTE: Child references parent's metadata, not its own

// ============================================
// TEST 14: Import Inheritance - Nested
// ============================================
console.log("Test 14: Import Inheritance - Nested");
// Create three snippets:
const grandparent = `{import: /parent2}`;
const parent2 = `{import: /child2}`;
const child2 = `Root: {snippet: shortcut}`;
// Setup:
// - Grandparent has shortcut "/gp"
// - Parent has shortcut "/p"
// - Child has shortcut "/c"
// User types: /gp
// Expected Output: "Root: /gp"
// NOTE: Even deeply nested, references the original root

// ============================================
// TEST 15: Import Inheritance - Trigger Preserved
// ============================================
console.log("Test 15: Import Inheritance - Trigger Preserved");
const parentWithTrigger = `{import: /childTrigger}`;
const childTrigger = `Trigger: {snippet: trigger}`;
// Setup:
// - Parent has shortcut "/parent"
// User types: /PARENT (uppercase)
// Expected Output: "Trigger: /PARENT"
// The exact trigger text is preserved through imports

// ============================================
// TEST 16: Formula Integration - Case Check
// ============================================
console.log("Test 16: Formula Integration - Case Check");
const snippet16 = `{if: snippet:trigger = upper(snippet:trigger); "ALL CAPS!"; "mixed/lowercase"}`;
// Setup: Snippet shortcut is "/test"
// Test A: User types /TEST → Expected: "ALL CAPS!"
// Test B: User types /test → Expected: "mixed/lowercase"
// Test C: User types /TeSt → Expected: "mixed/lowercase"

// ============================================
// TEST 17: Formula Integration - Shortcut in Expression
// ============================================
console.log("Test 17: Formula Integration - Shortcut in Expression");
const snippet17 = `{greeting = "Hello"}{greeting} from {snippet: shortcut}!`;
// Setup: Snippet shortcut is "/hi"
// Expected Output: "Hello from /hi!"

// ============================================
// TEST 18: Invalid Property Name
// ============================================
console.log("Test 18: Invalid Property Name");
const snippet18 = `Valid: {snippet: id}, Invalid: {snippet: invalid}, Also invalid: {snippet: foo}`;
// Expected Output: "Valid: [actual-id], Invalid: , Also invalid: "
// Unknown properties return empty string

// ============================================
// TEST 19: Empty/Missing Property Argument
// ============================================
console.log("Test 19: Empty Property Argument");
const snippet19 = `Default property: {snippet}`;
// Expected Output: "Default property: [snippet-name]"
// NOTE: When no property specified, defaults to 'name'

// ============================================
// TEST 20: Multi-Property Usage
// ============================================
console.log("Test 20: Multi-Property Usage");
const snippet20 = `
Snippet Details:
- ID: {snippet: id}
- Shortcut: {snippet: shortcut}
- Trigger: {snippet: trigger}
- Name: {snippet: name}
`;
// Setup: Create snippet named "Test Snippet" with shortcut "/info"
// User types: /INFO
// Expected Output:
// Snippet Details:
// - ID: [unique-id]
// - Shortcut: /info
// - Trigger: /INFO
// - Name: Test Snippet

// ============================================
// TEST 21: Trigger with Special Characters
// ============================================
console.log("Test 21: Trigger with Special Characters");
const snippet21 = `Triggered by: {snippet: trigger}`;
// Setup: Shortcut is "/test-123_abc"
// User types: /test-123_abc
// Expected Output: "Triggered by: /test-123_abc"

// ============================================
// TEST 22: Integration with Other Commands
// ============================================
console.log("Test 22: Integration with Other Commands");
const snippet22 = `
Date: {time: YYYY-MM-DD}
Snippet: {snippet: shortcut}
User: {user: name}
`;
// Setup: User name is "John Doe", snippet shortcut is "/report"
// Expected Output:
// Date: 2026-02-07
// Snippet: /report
// User: John Doe

// ============================================
// TEST 23: Trigger in Conditional Logic
// ============================================
console.log("Test 23: Trigger in Conditional Logic");
const snippet23 = `{if: contains(snippet:trigger, "URGENT"); "🚨 PRIORITY"; "Regular message"}`;
// Test A: User types /urgent → Expected: "Regular message"
// Test B: User types /URGENT → Expected: "🚨 PRIORITY"
// Test C: User types /URGENT-task → Expected: "🚨 PRIORITY"

// ============================================
// TEST 24: Chained Imports
// ============================================
console.log("Test 24: Chained Imports");
const chain1 = `Chain 1: {snippet: shortcut} {import: /chain2}`;
const chain2 = `Chain 2: {snippet: shortcut} {import: /chain3}`;
const chain3 = `Chain 3: {snippet: shortcut}`;
// Setup:
// - Chain 1 shortcut: "/c1"
// - Chain 2 shortcut: "/c2"
// - Chain 3 shortcut: "/c3"
// User types: /c1
// Expected Output: "Chain 1: /c1 Chain 2: /c1 Chain 3: /c1"
// All references point to root snippet

// ============================================
// USAGE NOTES
// ============================================
/*
 * The {snippet} command supports:
 * 
 * PROPERTIES:
 * - id: Unique snippet identifier (auto-generated on creation)
 * - shortcut: The snippet's trigger shortcut (e.g., "/sig")
 * - trigger: Exact text typed by user (CASE-SENSITIVE)
 * - name: Snippet name (optional, for backwards compatibility)
 * 
 * PROPERTY NAME VALIDATION:
 * - Property names MUST be lowercase
 * - {snippet: ID} returns empty (invalid uppercase)
 * - {snippet: id} returns the actual ID (valid)
 * - Unknown properties return empty string
 * 
 * TRIGGER vs SHORTCUT:
 * - shortcut: The defined trigger (always lowercase in system)
 * - trigger: What the user ACTUALLY typed (preserves case)
 * - Use trigger for case-sensitive logic
 * 
 * IMPORT INHERITANCE:
 * - ALWAYS references the ROOT snippet (initially triggered)
 * - Even in deeply nested imports
 * - {import} does NOT change which snippet is referenced
 * 
 * TRIM PARAMETER:
 * - trim=yes: Remove whitespace before AND after
 * - trim=no: Preserve whitespace (default)
 * - trim=left: Remove whitespace only on the left
 * - trim=right: Remove whitespace only on the right
 * 
 * FORMULA INTEGRATION:
 * - Use snippet:property in formulas
 * - Example: {= upper(snippet:trigger)}
 * - Example: {if: snippet:trigger = "/URGENT"; ...}
 * 
 * DEFAULT BEHAVIOR:
 * - {snippet} with no property defaults to 'name'
 * - Returns empty string if snippet has no name
 */
