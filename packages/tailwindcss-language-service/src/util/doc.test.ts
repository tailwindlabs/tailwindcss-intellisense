import { getTextWithoutComments } from './doc'
import { test, expect } from 'vitest'

test('Cleans JS', () => {
  let input = `
    /* Single-line block comment */
    const a = 1;

    // Single-line comment
    const b = 2;

    /*
     * Multi-line block comment
     * with asterisks on each line
     * spanning multiple lines
     */
    const c = 3;

    /**
     * JSDoc style comment
     * @param {string} name - The name parameter
     * @returns {void}
     */
    function greet(name) {
      console.log("Hello, " + name);
    }

    // Double-quoted strings
    const str1 = "This is a double-quoted string";
    const str2 = "String with \\"escaped\\" quotes";
    const str3 = "String with // fake comment inside";
    const str4 = "String with /* fake block comment */ inside";

    // Single-quoted strings
    const str5 = 'This is a single-quoted string';
    const str6 = 'String with \\'escaped\\' quotes';
    const str7 = 'String with // fake comment inside';
    const str8 = 'String with /* fake block comment */ inside';

    // Template literals - single line
    const tmpl1 = \`Simple template literal\`;
    const tmpl2 = \`Template with \${expression} interpolation\`;
    const tmpl3 = \`Template with // fake comment\`;
    const tmpl4 = \`Template with /* fake block */ comment\`;

    // Template literals - multi-line
    const tmpl5 = \`
      Multi-line template literal
      spanning several lines
      with \${nested} expressions
    \`;

    const tmpl6 = \`
      Template with \${
        // This is a real comment inside interpolation
        someValue
      } complex interpolation
    \`;

    // Regex patterns - various flags
    const regex1 = /simple/;
    const regex2 = /with-flags/gi;
    const regex3 = /multi-flag/gimsuy;
    const regex4 = /pattern\\/with\\/slashes/g;
    const regex5 = /pattern with spaces/;
    const regex6 = /[a-z]+(foo|bar)*\\d{2,4}/i;

    // Regex that looks like comments
    const regex7 = /\\/\\/ not a comment/;
    const regex8 = /\\/\\* also not a comment \\*\\//;

    // Division vs regex ambiguity
    const division = 10 / 2 / 1;
    const afterParen = (x) => /regex-after-arrow/g;
    const inCondition = /test/.test(str) ? /yes/g : /no/i;

    // Nested structures
    const obj = {
      // Comment inside object
      key: "value", /* inline comment */
      nested: {
        /* deeply nested comment */
        deep: \`template \${
          // comment in template
          value /* another */
        }\`
      }
    };

    // Class with various comment styles
    class Example {
      // Property comment
      prop = "value";

      /**
       * Method JSDoc
       */
      method() {
        // Method body comment
        return /* inline */ true;
      }
    }

    // Arrow functions with comments
    const arrow1 = () => /* comment */ 42;
    const arrow2 = (/* param comment */) => {};
    const arrow3 = (a /* inline */, b) => a + b;

    // Edge cases
    const empty = "";
    const emptyTemplate = \`\`;
    const emptyRegex = /(?:)/;

    // URL-like strings (contains //)
    const url = "https://example.com/path";
    const protocol = 'file://localhost/';

    // Consecutive comments
    // First comment
    // Second comment
    /* Block one */ /* Block two */
    const afterComments = true;

    // Mixed quotes and escapes
    const mixed = "It's a \\"quoted\\" string";
    const mixed2 = 'It\\'s a "quoted" string';
    const mixed3 = \`It's a "quoted" \\\`template\\\`\`;

    // Tagged template literals
    const tagged = html\`<div class="\${cls}">content</div>\`;
    const css = css\`
      .selector {
        /* CSS comment inside template */
        color: red; // not a JS comment
      }
    \`;

    // Regex with special characters
    const specialRegex = /[\\[\\]{}()*+?.,\\\\^$|#\\s]/g;
    const unicodeRegex = /\\p{Script=Latin}/u;

    // Comments at end of lines with various content
    const withTrailing = 123; // trailing comment
    const withBlock = 456; /* trailing block */
    const both = 789; // line /* nested */

    // String concatenation that looks tricky
    const concat = "start" + /* comment */ "end";
    const concat2 = 'a' + 'b' + /* c */ 'd';
  `

  let result = getTextWithoutComments(input, 'js')
  expect(result).toMatchInlineSnapshot(`
    "
                                       
        const a = 1;

                              
        const b = 2;

          
                                   
                                      
                                  
           
        const c = 3;

           
                              
                                                    
                          
           
        function greet(name) {
          console.log("Hello, " + name);
        }

                                
        const str1 = "This is a double-quoted string";
        const str2 = "String with \\"escaped\\" quotes";
        const str3 = "String with // fake comment inside";
        const str4 = "String with /* fake block comment */ inside";

                                
        const str5 = 'This is a single-quoted string';
        const str6 = 'String with \\'escaped\\' quotes';
        const str7 = 'String with // fake comment inside';
        const str8 = 'String with /* fake block comment */ inside';

                                          
        const tmpl1 = \`Simple template literal\`;
        const tmpl2 = \`Template with \${expression} interpolation\`;
        const tmpl3 = \`Template with // fake comment\`;
        const tmpl4 = \`Template with /* fake block */ comment\`;

                                         
        const tmpl5 = \`
          Multi-line template literal
          spanning several lines
          with \${nested} expressions
        \`;

        const tmpl6 = \`
          Template with \${
            // This is a real comment inside interpolation
            someValue
          } complex interpolation
        \`;

                                         
        const regex1 =         ;
        const regex2 =             gi;
        const regex3 =             gimsuy;
        const regex4 =                         g;
        const regex5 =                      ;
        const regex6 =                          i;

                                         
        const regex7 =                     ;
        const regex8 =                               ;

                                      
        const division = 10 / 2 / 1;
        const afterParen = (x) =>                    g;
        const inCondition =       .test(str) ?      g :     i;

                            
        const obj = {
                                  
          key: "value",                     
          nested: {
                                       
            deep: \`template \${
              // comment in template
              value /* another */
            }\`
          }
        };

                                            
        class Example {
                             
          prop = "value";

             
                         
             
          method() {
                                  
            return              true;
          }
        }

                                        
        const arrow1 = () =>               42;
        const arrow2 = (                   ) => {};
        const arrow3 = (a             , b) => a + b;

                     
        const empty = "";
        const emptyTemplate = \`\`;
        const emptyRegex =       ;

                                         
        const url = "https://example.com/path";
        const protocol = 'file://localhost/';

                               
                        
                         
                                       
        const afterComments = true;

                                   
        const mixed = "It's a \\"quoted\\" string";
        const mixed2 = 'It\\'s a "quoted" string';
        const mixed3 = \`It's a "quoted" \\\`template\\\`\`;

                                   
        const tagged = html\`<div class="\${cls}">content</div>\`;
        const css = css\`
          .selector {
            /* CSS comment inside template */
            color: red; // not a JS comment
          }
        \`;

                                        
        const specialRegex =                          g;
        const unicodeRegex =                   u;

                                                        
        const withTrailing = 123;                    
        const withBlock = 456;                     
        const both = 789;                     

                                                 
        const concat = "start" +               "end";
        const concat2 = 'a' + 'b' +         'd';
      "
  `)
})

test('Cleans HTML', () => {
  let input = `
    <!-- Simple HTML comment -->
    <div class="container">

    <!-- Multi-line
         HTML comment
         spanning several lines -->
    <p>Some text</p>

    <!--
      Comment with leading whitespace
      and multiple lines
    -->
    <span>More text</span>

    <!-- Comment with dashes - inside - it -->
    <div>Content</div>

    <!-- Comment with "double quotes" inside -->
    <div>Content</div>

    <!-- Comment with 'single quotes' inside -->
    <div>Content</div>

    <!-- Comment with <tags> inside -->
    <div>Content</div>

    <!-- Comment with <!-- nested opening (invalid but should handle) -->
    <div>Content</div>

    <!-- Comment ending with multiple dashes --->
    <div>Content</div>

    <!---->
    <div>Empty comment above</div>

    <!--- Comment starting with extra dash -->
    <div>Content</div>

    <!-- Comment with JS-like content: const x = 1; // not a comment -->
    <div>Content</div>

    <!-- Comment with CSS-like content: .class { /* not a comment */ } -->
    <div>Content</div>

    <!-- Consecutive --><!-- Comments -->
    <div>Content</div>

    <div><!-- Inline comment --></div>

    <div class="<!-- not a comment, but in attribute -->">Content</div>

    <!-- Comment with special characters: & < > " ' -->
    <div>Content</div>

    <!-- Comment with entities: &amp; &lt; &gt; &quot; -->
    <div>Content</div>

    <!--[if IE]>
      Conditional comment for IE
    <![endif]-->
    <div>Content</div>

    <!--[if !IE]><!-->
      Content for non-IE browsers
    <!--<![endif]-->
    <div>Content</div>

    <!-- Comment before attribute -->
    <div
      <!-- This is technically invalid HTML but we should handle it -->
      class="test"
    >Content</div>

    <!-- Comment with template syntax inside: {{ variable }} -->
    <div>Content</div>

    <!-- Comment with script-like content:
      <script>
        const x = 1;
        // JS comment
        /* block comment */
      </script>
    -->
    <div>Content</div>

    <!-- URLs in comments: https://example.com -->
    <div>Content</div>

    <!-- Regex-like content: /pattern/gi -->
    <div>Content</div>

    <script>
      // JS comment inside script tag
      /* JS block comment */
      const str = "<!-- not an HTML comment -->";
    </script>

    <style>
      /* CSS comment inside style tag */
      .class {
        content: "<!-- not an HTML comment -->";
      }
    </style>

    <!-- Comment at the very end -->
  `

  let result = getTextWithoutComments(input, 'html')
  expect(result).toMatchInlineSnapshot(`
    "
                                    
        <div class="container">

                       
                         
                                       
        <p>Some text</p>

            
                                         
                            
           
        <span>More text</span>

                                                  
        <div>Content</div>

                                                    
        <div>Content</div>

                                                    
        <div>Content</div>

                                           
        <div>Content</div>

                                                                             
        <div>Content</div>

                                                     
        <div>Content</div>

               
        <div>Empty comment above</div>

                                                  
        <div>Content</div>

                                                                            
        <div>Content</div>

                                                                              
        <div>Content</div>

                                             
        <div>Content</div>

        <div>                       </div>

        <div class="<!-- not a comment, but in attribute -->">Content</div>

                                                           
        <div>Content</div>

                                                              
        <div>Content</div>

                    
                                    
                    
        <div>Content</div>

                          
          Content for non-IE browsers
                        
        <div>Content</div>

                                         
        <div
                                                                           
          class="test"
        >Content</div>

                                                                    
        <div>Content</div>

                                              
                  
                        
                         
                               
                   
           
        <div>Content</div>

                                                      
        <div>Content</div>

                                                
        <div>Content</div>

        <script>
          // JS comment inside script tag
          /* JS block comment */
          const str = "<!-- not an HTML comment -->";
        </script>

        <style>
          /* CSS comment inside style tag */
          .class {
            content: "<!-- not an HTML comment -->";
          }
        </style>

                                        
      "
  `)
})

test('Cleans CSS', () => {
  let input = `
    /* Simple single-line block comment */
    .class1 { color: red; }

    /*
     * Multi-line block comment
     * with asterisks on each line
     * spanning multiple lines
     */
    .class2 { color: blue; }

    /**
     * Doc-style comment
     * Often used for documentation
     */
    .class3 { color: green; }

    /* Comment with "double quotes" inside */
    .class4 { color: yellow; }

    /* Comment with 'single quotes' inside */
    .class5 { color: orange; }

    /* Comment with special chars: < > & */
    .class6 { color: purple; }

    /* Comment with CSS-like content: .fake { color: red; } */
    .class7 { color: pink; }

    /* Comment with URL-like content: https://example.com */
    .class8 { color: brown; }

    /* Comment with // which is not a line comment in CSS */
    .class9 { color: gray; }

    /* Consecutive */ /* Comments */
    .class10 { color: teal; }

    .inline { color: /* inline comment */ red; }

    .property /* comment between property */ : /* and value */ blue;

    /* Empty comment: *//**/
    .class11 { color: navy; }

    /* Comment with asterisks **** inside *** */
    .class12 { color: olive; }

    /* Comment ending with multiple asterisks ***/
    .class13 { color: maroon; }

    /*** Comment starting with multiple asterisks */
    .class14 { color: lime; }

    /* Comment with nested /* fake opening */
    .class15 { color: aqua; }

    /* Comment with HTML: <div class="test">content</div> */
    .class16 { color: fuchsia; }

    /* Comment with JS: const x = 1; // not a comment */
    .class17 { color: silver; }

    /* Comment with escaped content: \\*/ still in comment */
    .class18 { color: black; }

    /* Multi-line
       comment without
       asterisks on
       each line */
    .class19 { color: white; }

    .url-property {
      background: url("image.png"); /* comment after url */
      background: url('image.png'); /* another comment */
      background: url(image.png); /* unquoted url */
    }

    .string-property {
      content: "String with /* fake comment */ inside";
      content: 'String with /* fake comment */ inside';
      content: "String with // not a comment";
    }

    .data-uri {
      background: url("data:image/svg+xml,<svg>/* not a comment */</svg>");
    }

    /* Comment before at-rule */
    @media screen and (min-width: 768px) {
      /* Comment inside at-rule */
      .responsive { color: red; }
    }

    /* Comment before keyframes */
    @keyframes spin {
      /* Comment at start */
      0% { transform: rotate(0deg); }
      /* Comment between keyframes */
      100% { transform: rotate(360deg); }
      /* Comment at end */
    }

    :root {
      --my-var: red; /* Comment after custom property */
      /* Comment before custom property */
      --another-var: blue;
    }

    .calc-property {
      width: calc(100% - 20px); /* Comment after calc */
      height: calc(/* comment in calc */ 50vh - 10px);
    }

    /* Comment with unicode: 你好 مرحبا 🎉 */
    .unicode { color: red; }

    /* Very long comment that goes on and on and on and on and on and on and on and on and on and on and on and on and on */
    .long { color: red; }

    /*
      Comment with various whitespace:
      	tabs
        spaces

      blank lines
    */
    .whitespace { color: red; }

    /* Comment immediately before brace */{
      color: red;
    }

    .selector/* comment in selector */.chained { color: red; }

    /* Final comment at end of file */
  `

  let result = getTextWithoutComments(input, 'css')
  expect(result).toMatchInlineSnapshot(`
    "
                                              
        .class1 { color: red; }

          
                                   
                                      
                                  
           
        .class2 { color: blue; }

           
                            
                                       
           
        .class3 { color: green; }

                                                 
        .class4 { color: yellow; }

                                                 
        .class5 { color: orange; }

                                               
        .class6 { color: purple; }

                                                                  
        .class7 { color: pink; }

                                                                
        .class8 { color: brown; }

                                                                
        .class9 { color: gray; }

                                        
        .class10 { color: teal; }

        .inline { color:                      red; }

        .property                                :                 blue;

                                
        .class11 { color: navy; }

                                                    
        .class12 { color: olive; }

                                                      
        .class13 { color: maroon; }

                                                        
        .class14 { color: lime; }

                                                 
        .class15 { color: aqua; }

                                                                
        .class16 { color: fuchsia; }

                                                            
        .class17 { color: silver; }

                                                                
        .class18 { color: black; }

                     
                          
                       
                       
        .class19 { color: white; }

        .url-property {
          background: url("image.png");                        
          background: url('image.png');                      
          background: url(image.png);                   
        }

        .string-property {
          content: "String with /* fake comment */ inside";
          content: 'String with /* fake comment */ inside';
          content: "String with // not a comment";
        }

        .data-uri {
          background: url("data:image/svg+xml,<svg>/* not a comment */</svg>");
        }

                                    
        @media screen and (min-width: 768px) {
                                      
          .responsive { color: red; }
        }

                                      
        @keyframes spin {
                                
          0% { transform: rotate(0deg); }
                                         
          100% { transform: rotate(360deg); }
                              
        }

        :root {
          --my-var: red;                                    
                                              
          --another-var: blue;
        }

        .calc-property {
          width: calc(100% - 20px);                         
          height: calc(                      50vh - 10px);
        }

                                               
        .unicode { color: red; }

                                                                                                                                
        .long { color: red; }

          
                                          
               
                  

                     
          
        .whitespace { color: red; }

                                              {
          color: red;
        }

        .selector                         .chained { color: red; }

                                          
      "
  `)
})

test('Cleans multibyte CSS', () => {
  let input = `/* Comment with unicode: 你好 مرحبا 🎉 */`

  let result = getTextWithoutComments(input, 'css')
  expect(input.length).toEqual(result.length)
  expect(result).toEqual('                                       ')
})
