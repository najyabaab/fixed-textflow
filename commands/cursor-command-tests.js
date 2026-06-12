/**
 * Test Examples for {cursor} Command
 * 
 * This file contains comprehensive test cases for the cursor command.
 */

// ============================================
// TEST 1: Basic Cursor Positioning (Mid-Text)
// ============================================
console.log("Test 1: Basic Cursor Positioning");
const snippet1 = `Hello {cursor} World!`;
// Expected: 
// - Text inserted: "Hello  World!"
// - Cursor positioned between "Hello" and "World"

// ============================================
// TEST 2: Cursor at Start
// ============================================
console.log("Test 2: Cursor at Start");
const snippet2 = `{cursor}This is the beginning`;
// Expected:
// - Text inserted: "This is the beginning"
// - Cursor positioned at the very start (index 0)

// ============================================
// TEST 3: Cursor at End
// ============================================
console.log("Test 3: Cursor at End");
const snippet3 = `This is the end{cursor}`;
// Expected:
// - Text inserted: "This is the end"
// - Cursor positioned at the very end

// ============================================
// TEST 4: Trim Whitespace - Yes
// ============================================
console.log("Test 4: Trim Whitespace - Yes");
const snippet4 = `Text before   {cursor: trim=yes}   text after`;
// Expected:
// - Text inserted: "Text beforetext after"
// - Whitespace removed before AND after cursor
// - Cursor positioned between "before" and "text"

// ============================================
// TEST 5: Trim Whitespace - Left
// ============================================
console.log("Test 5: Trim Whitespace - Left");
const snippet5 = `Text before   {cursor: trim=left}   text after`;
// Expected:
// - Text inserted: "Text before   text after"
// - Only left whitespace removed
// - Cursor positioned after "before" with trailing spaces

// ============================================
// TEST 6: Trim Whitespace - Right
// ============================================
console.log("Test 6: Trim Whitespace - Right");
const snippet6 = `Text before   {cursor: trim=right}text after`;
// Expected:
// - Text inserted: "Text before   text after"
// - Only right whitespace removed
// - Cursor positioned before "text" with no leading spaces on right

// ============================================
// TEST 7: Trim Whitespace - No (Default)
// ============================================
console.log("Test 7: Trim Whitespace - No");
const snippet7 = `Text before   {cursor}   text after`;
// Expected:
// - Text inserted: "Text before      text after"
// - All whitespace preserved
// - Cursor positioned in the middle of the whitespace

// ============================================
// TEST 8: Singleton Validation (Should Error)
// ============================================
console.log("Test 8: Singleton Validation - Multiple Cursors");
const snippet8 = `First {cursor} Middle {cursor} Last`;
// Expected:
// - Error thrown: "Validation Error: Only one {cursor} command is allowed per snippet. Found 2 cursor commands."
// - Snippet should NOT be inserted

// ============================================
// TEST 9: Integration with Form Fields
// ============================================
console.log("Test 9: Integration with Form Fields");
const snippet9 = `Dear {textfield: name=Name},

{cursor}Thank you for your inquiry.

Best regards,
Support Team`;
// Expected Flow:
// 1. Form modal appears for "Name" field
// 2. User enters "John"
// 3. Text inserted: "Dear John,\n\nThank you for your inquiry.\n\nBest regards,\nSupport Team"
// 4. Cursor positioned at the blank line before "Thank you"

// ============================================
// TEST 10: Integration with Autopilot (Key Commands)
// ============================================
console.log("Test 10: Integration with Autopilot");
const snippet10 = `{cursor}Email: {textfield: name=Email}
{key: tab}
Password: {textfield: name=Password}
{key: tab}
{key: enter}`;
// Expected Flow:
// 1. Form appears, user fills Email and Password
// 2. Text is inserted starting with "Email: user@example.com"
// 3. Cursor positioned at very start (before "Email:")
// 4. Tab command moves cursor to next field
// 5. Another tab
// 6. Enter is pressed

// ============================================
// TEST 11: Complex Autopilot Example
// ============================================
console.log("Test 11: Complex Autopilot Example");
const snippet11 = `{cursor}Hi {textfield: name=name}
Thank you for your message!
{key: shift-tab}
{key: shift-tab}
{key: enter}`;
// Expected Flow:
// 1. Form appears for "name" field - user enters "Alice"
// 2. Text inserted: "Hi Alice\nThank you for your message!"
// 3. Cursor positioned before "Hi" (at the very start)
// 4. Two shift-tabs navigate backward in the form
// 5. Enter is pressed

// ============================================
// TEST 12: Cursor with Code Snippet
// ============================================
console.log("Test 12: Cursor in Code Snippet");
const snippet12 = `function example() {
    {cursor: trim=yes}
}`;
// Expected:
// - Text inserted: "function example() {\n    \n}"
// - Cursor positioned on the empty line inside the function
// - Indentation preserved

// ============================================
// TEST 13: Multiple Commands Before Cursor
// ============================================
console.log("Test 13: Multiple Commands Before Cursor");
const snippet13 = `Date: {time: YYYY-MM-DD}
Subject: {textfield: name=Subject}

{cursor}Dear Customer,

This is an automated message.`;
// Expected:
// 1. Current date inserted
// 2. Form appears for Subject
// 3. All text inserted with proper formatting
// 4. Cursor positioned at the blank line before "Dear Customer"

// ============================================
// TEST 14: Cursor Position Calculation
// ============================================
console.log("Test 14: Cursor Position Calculation");
const snippet14 = `ABC{cursor}XYZ`;
// Expected:
// - Text: "ABCXYZ"
// - Cursor position: 3 (after C, before X)

// ============================================
// TEST 15: Edge Case - Empty Snippet with Cursor
// ============================================
console.log("Test 15: Empty Snippet with Cursor");
const snippet15 = `{cursor}`;
// Expected:
// - Text: "" (empty)
// - Cursor position: 0

// ============================================
// TEST 16: Backward Compatibility with |cursor|
// ============================================
console.log("Test 16: Backward Compatibility");
const snippet16a = `Hello |cursor| World`;
const snippet16b = `Hello {cursor} World`;
// Expected:
// Both should work identically
// - Text: "Hello  World"
// - Cursor between Hello and World

// ============================================
// TEST 17: Cursor with Variable Expansion
// ============================================
console.log("Test 17: Cursor with Variable Expansion");
const snippet17 = `{name = "John"}
Hello {name}, {cursor}welcome!`;
// Expected:
// - Variable "John" is substituted
// - Text: "Hello John, welcome!"
// - Cursor positioned after the comma before "welcome"

// ============================================
// USAGE NOTES
// ============================================
/*
 * The {cursor} command supports:
 * 
 * SINGLETON CONSTRAINT:
 * - Only one {cursor} per snippet allowed
 * - Multiple cursors will throw a validation error
 * 
 * TRIM PARAMETER:
 * - trim=yes: Remove whitespace before AND after the command
 * - trim=no: Preserve whitespace (default)
 * - trim=left: Remove whitespace only on the left
 * - trim=right: Remove whitespace only on the right
 * 
 * POSITIONING:
 * - Works in any position: start, middle, or end
 * - Position calculated after all command execution
 * - Integrates with form fields and autopilot commands
 * 
 * AUTOPILOT INTEGRATION:
 * - Cursor is positioned AFTER text insertion
 * - BEFORE autopilot commands (like {key: tab}) execute
 * - Allows precise control of focus in multi-step workflows
 * 
 * BACKWARD COMPATIBILITY:
 * - Old |cursor| placeholder still works
 * - New {cursor} syntax recommended for trim control
 */
