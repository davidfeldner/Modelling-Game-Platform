
interface NamedElement {
    name: string
}


terminal BOOLEAN returns boolean: 'true' | 'false';
terminal DATE: /\d{2}-\d{2}-\d{4}/;
hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;
terminal VERSION_ID: /[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+)*/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
