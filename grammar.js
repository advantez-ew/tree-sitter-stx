/**
 * @file Grammar for Jetter(Bucher) Automation controller programming language STX
 * @author Eric Wang <nohackwhl@hotmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check
const unsignedInteger = seq(/\d/, repeat(/\d/));

const signedInteger = seq(optional(/[\+-]/), unsignedInteger);

export default grammar({
  name: "stx",
  extras: ($) => [$.inline_comment, $.block_comment, /\s/],

  word: ($) => $.identifier,

  conflicts: ($) => [[$.case], [$.variable], [$.variable, $.call_expression]],

  supertypes: ($) => [
    $._definition,
    $.statement,
    $._control_statement,
    $._loop_statement,
    $._expression,
    $._literal,
  ],

  rules: {
    // TODO: add the actual grammar rules
    source_file: ($) => repeat(choice($._definition, $._declaration)),

    /*
          Statements
        */

    statement: ($) =>
      choice(
        $.assignment,
        $.expression_statement,
        $.call_statement,
        $._control_statement,
        $._loop_statement,
        $.continue_statement,
        $.exit_statement,
      ),

    _control_statement: ($) =>
      choice(
        $.case_statement,
        $.if_statement,
        $.when_statement,
        $.whenmax_statement,
        $.whencontinue_statement,
      ),

    _loop_statement: ($) =>
      choice(
        $.for_statement,
        $.foreach_statement,
        $.repeat_statement,
        $.while_statement,
      ),

    assignment: ($) => seq($.variable, ":=", $._expression, ";"),

    expression_statement: ($) => seq($.variable, ";"),
    continue_statement: ($) => seq(/continue/i, ";"),
    exit_statement: ($) => seq(/exit/i, ";"),

    call_statement: ($) => seq($.call_expression, ";"),

    whenmax_statement: ($) =>
      seq(
        /when_max/i,
        "(",
        $._expression,
        $.variable,
        ")",
        field("condition", $._expression),
        /continue/i,
        ";",
      ),
    whencontinue_statement: ($) =>
      seq(/when/i, field("condition", $._expression), /continue/i, ";"),

    when_statement: ($) =>
      seq(
        /when/i,
        field("condition", $._expression),
        /then/i,
        repeat($.statement),
        repeat($.elsewhen_clause),
        optional($.elsetime_clause),
        /end_when/i,
        optional(";"),
      ),

    if_statement: ($) =>
      seq(
        /if/i,
        field("condition", $._expression),
        /then/i,
        repeat($.statement),
        repeat($.elseif_clause),
        optional($.else_clause),
        /end_if/i,
        optional(";"),
      ),

    case_statement: ($) =>
      seq(
        /case/i,
        field("caseControlValue", $.variable),
        /of/i,
        repeat($.case),
        optional($.else_case),
        /end_case/i,
        optional(";"),
      ),

    for_statement: ($) =>
      seq(
        /for/i,
        $.for_range,
        /do/i,
        repeat($.statement),
        /end_for/i,
        optional(";"),
      ),
    foreach_statement: ($) =>
      seq(
        /foreach/i,
        $.variable,
        ":",
        $.variable,
        /do/i,
        repeat($.statement),
        /end_foreach/i,
        optional(";"),
      ),

    repeat_statement: ($) =>
      seq(
        /repeat/i,
        repeat($.statement),
        /until/i,
        field("terminationCondition", $._expression),
        ";",
        optional(/end_repeat/i),
        optional(";"),
      ),

    while_statement: ($) =>
      seq(
        /while/i,
        $._expression,
        /do/i,
        repeat($.statement),
        /end_while/i,
        optional(";"),
      ),
    /*
          Statement components
        */

    elseif_clause: ($) =>
      seq(
        /(elseif)|(else_if)/i,
        field("elsifCondition", $._expression),
        /then/i,
        repeat($.statement),
      ),
    elsewhen_clause: ($) =>
      seq(
        /else_when)/i,
        field("elsifCondition", $._expression),
        /then/i,
        repeat($.statement),
      ),
    elsetime_clause: ($) =>
      seq(/else_time/i, $._expression, /then/i, repeat($.statement)),

    else_clause: ($) => seq(/else/i, repeat($.statement)),

    case: ($) => seq($.case_value, ":", repeat($.statement)),

    else_case: ($) => seq(/else/i, repeat($.statement)),

    case_value: ($) =>
      commaSep1(
        choice(
          alias(token(signedInteger), $.integer),
          $.index_range,
          $.identifier,
        ),
      ),

    index_range: ($) =>
      seq(
        field(
          "lowerBound",
          choice(alias(token(signedInteger), $.integer), $.identifier),
        ),
        "..",
        field(
          "upperBound",
          choice(alias(token(signedInteger), $.integer), $.identifier),
        ),
      ),

    for_range: ($) =>
      seq(
        $.statement_initialization,
        /to/i,
        $._expression,
        optional(seq(/by/i, $._expression)),
      ),

    statement_initialization: ($) => seq($.variable, ":=", $._expression),
    /*
          Declarations
        */
    const_define: ($) =>
      seq(field("name", $.identifier), "=", $.variable_initialization),

    var_define: ($) =>
      seq(
        field("name", $.identifier),
        ":",
        $._data_type,
        $.variable_initialization,
      ),
    /*
          Declaration components
        */
    variable_initialization: ($) =>
      seq(
        ":=",
        choice(
          commaSep1(choice($._expression, $.repetition_expression)),
          seq(
            "[",
            commaSep1(choice($._expression, $.repetition_expression)),
            "]",
          ),
        ),
        ";",
      ),
    /*
          Expressions
        */

    _expression: ($) =>
      choice(
        $._literal,
        $.variable,
        $.parenthesis_expression,
        $.unary_expression,
        $.binary_expression,
        $.mask_expression,
        $.call_expression,
      ),

    parenthesis_expression: ($) => seq("(", $._expression, ")"),

    unary_expression: ($) =>
      choice(
        prec(
          8,
          choice(
            seq("@", $._expression),
            seq("&", $._expression),
            seq("+", $._expression),
            seq("-", $._expression),
            seq(/w?not/i, $._expression),
            seq("!", $._expression),
            seq("~", $._expression),
          ),
          prec(1, seq("$", $._expression)),
        ),
      ),

    binary_expression: ($) =>
      choice(
        prec.left(7, seq($._expression, "**", $._expression)), // Not supported in Automation Studio
        prec.left(6, seq($._expression, "*", $._expression)),
        prec.left(6, seq($._expression, "/", $._expression)),
        prec.left(6, seq($._expression, /wand/i, $._expression)),
        prec.left(6, seq($._expression, "&", $._expression)),
        prec.left(6, seq($._expression, /shl/i, $._expression)),
        prec.left(6, seq($._expression, "<<", $._expression)),
        prec.left(6, seq($._expression, /shr/i, $._expression)),
        prec.left(6, seq($._expression, ">>", $._expression)),
        prec.left(6, seq($._expression, /mod/i, $._expression)),
        prec.left(5, seq($._expression, "+", $._expression)),
        prec.left(5, seq($._expression, "-", $._expression)),
        prec.left(5, seq($._expression, /wor/i, $._expression)),
        prec.left(5, seq($._expression, "|", $._expression)),
        prec.left(5, seq($._expression, /wxor/i, $._expression)),
        prec.left(5, seq($._expression, "^", $._expression)),
        prec.left(4, seq($._expression, "<", $._expression)),
        prec.left(4, seq($._expression, ">", $._expression)),
        prec.left(4, seq($._expression, "=", $._expression)),
        prec.left(4, seq($._expression, "==", $._expression)),
        prec.left(4, seq($._expression, "<=", $._expression)),
        prec.left(4, seq($._expression, ">=", $._expression)),
        prec.left(4, seq($._expression, "<>", $._expression)),
        prec.left(4, seq($._expression, "!=", $._expression)),
        prec.left(3, seq($._expression, /and/i, $._expression)),
        prec.left(3, seq($._expression, "&&", $._expression)),
        prec.left(2, seq($._expression, /or/i, $._expression)),
        prec.left(2, seq($._expression, "||", $._expression)),
        prec.left(2, seq($._expression, /xor/i, $._expression)),
        prec.left(2, seq($._expression, "^^", $._expression)),
      ),

    parameter_assignment: ($) =>
      choice(
        seq(alias($.identifier, $.parameter), ":=", $._expression),
        seq(alias($.identifier, $.parameter), "+=", $._expression),
        seq(alias($.identifier, $.parameter), "-=", $._expression),
        seq(alias($.identifier, $.parameter), "*=", $._expression),
        seq(alias($.identifier, $.parameter), "/=", $._expression),
        seq(alias($.identifier, $.parameter), "%=", $._expression),
        seq(alias($.identifier, $.parameter), "<<=", $._expression),
        seq(alias($.identifier, $.parameter), ">>=", $._expression),
        seq(alias($.identifier, $.parameter), "|=", $._expression),
        seq(alias($.identifier, $.parameter), "&=", $._expression),
        seq(alias($.identifier, $.parameter), "^=", $._expression),
        seq(alias($.identifier, $.parameter), "**=", $._expression),
      ),

    call_expression: ($) =>
      seq(
        field("functionName", $.identifier),
        "(",
        commaSep(field("input", choice($.parameter_assignment, $._expression))), // Function calls have ordered lists allowing expressions
        ")",
      ),

    mask_expression: ($) => seq($.variable, token.immediate("."), /\d{1,2}/),

    repetition_expression: ($) => seq($._expression, "(", $._expression, ")"),
    /*
         Variables
       */

    variable: ($) =>
      seq(
        field("name", $.identifier),
        optional($.index),
        optional($.structure_member),
      ),

    index: ($) =>
      seq(
        "[",
        field("dim1", $._expression),
        optional(seq(",", field("dim2", $._expression))),
        "]",
      ),

    structure_member: ($) =>
      seq(token.immediate("."), choice($.variable, $.call_expression)),
    /*
         Data types
       */
    _data_type: ($) =>
      choice(
        $.basic_data_type,
        alias($.identifier, $.derived_data_type),
        $.array_type,
        $.pointer_type,
      ),

    basic_data_type: ($) =>
      choice(
        /bool/i,
        /bit/i,
        /char/i,
        /byte/i,
        /d?word/i,
        /int8/i,
        /int16/i,
        /int(32)?/i,
        /long/i,
        /int64/i,
        /qword/i,
        /float/i,
        /double/i,
        /string/i,
        /regstring/i,
        /usint/i,
        /sint/i,
        /int/i,
        /l?real/i,
        /small/i,
        /short/i,
        /single/i,
      ),

    array_type: ($) =>
      seq(
        /ARRAY/i,
        "[",
        commaSep1($.index_range),
        "]",
        "OF",
        choice($.basic_data_type, alias($.identifier, $.derived_data_type)),
      ),

    pointer_type: ($) =>
      choice(
        seq(
          /pointer to( index of)?/i,
          choice(
            $.basic_data_type,
            alias($.identifier, $.derived_data_type),
            $.array_type,
          ),
        ),
        seq(
          "&",
          choice(
            $.basic_data_type,
            alias($.identifier, $.derived_data_type),
            $.array_type,
          ),
        ),
        seq(/pointer to located/i, choice($.basic_data_type, $.array_type)),
      ),

    /*
         Literals
    */

    _literal: ($) =>
      choice(
        $.boolean,
        $.integer,
        $.floating_point,
        $.binary,
        $.hexidecimal,
        $.time,
        $.string,
        $.date_constant,
        $.time_constant,
      ),

    date_contant: ($) => token(seq(/DT/i, "#", /\d{4}-\d{2}-\d{2}/)),

    time_constant: ($) =>
      token(seq(/TM/i, "#", /([0-1]\d|2[0-3]):[0-5]\d:[0-5]\d:(\d\d\d)/)),

    boolean: ($) => token(choice(/TRUE/i, /FALSE/i)),

    integer: ($) => {
      return token(unsignedInteger);
    },

    floating_point: ($) => {
      const scientific = seq(/[eE]/, signedInteger);
      return token(
        seq(
          unsignedInteger,
          choice(
            seq(".", repeat(choice("_", /\d/)), optional(scientific)),
            scientific,
          ),
        ),
      );
    },

    binary: ($) => token(seq(/0b/i, /_*[0-1]/, repeat(choice("_", /[0-1]/)))),

    hexidecimal: ($) =>
      token(seq(/0x/i, /_*[0-9a-fA-F]/, repeat(choice("_", /[0-9a-fA-F]/)))),

    ip: ($) =>
      token(
        seq(
          /IP/i,
          "#",
          /((25[0-5]|2[0-4]\d|[10]?\d?\d)\.){3}(25[0-5]|2[0-4]\d|[10]?\d?\d)/,
        ),
      ),

    time: ($) =>
      token(
        seq(
          /T/i,
          "#",
          optional("-"),
          optional(/\d{1,2}\.?\d{1,2}[dD]/),
          optional(/\d{1,3}\.?\d{1,2}[hH]/),
          optional(/\d{1,5}\.?\d{1,2}[mM]/),
          optional(/\d{1,9}\.?\d{1,2}[sS]/),
          optional(/\d{1,9}\.?\d{1,2}((ms)|(MS))/),
        ),
      ),

    string: ($) => token(prec.left(seq("'", /.*/, "'"))),

    inline_comment: ($) => token(seq("//", /.*/)),

    // http://stackoverflow.com/questions/13014947/regex-to-match-a-c-style-multiline-comment/36328890#36328890
    block_comment: ($) => token(seq("(*", /[^*]*\*+([^*)][^*]*\*+)*/, ")")),

    identifier: ($) => /[a-zA-Z_]\w*/,
  },
});
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

function commaSep(rule) {
  return optional(commaSep1(rule));
}
