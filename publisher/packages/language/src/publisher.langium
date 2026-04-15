grammar Publisher

interface NamedElement {
    name: string
}

interface PublisherType extends NamedElement {
    balance: number
}

interface PublisherGameType extends NamedElement {
    release_date: string
    price: number
    state: string
    versions: PublisherVersionType[]
    genre: @PublisherGenreType[]
    publisher: @PublisherType
}

interface PublisherGenreType extends NamedElement {
    description: string
}

interface PublisherVersionType {
    ID: string
    game_files: string
    is_current: boolean
    approved: boolean
}

interface PublisherSaleType extends NamedElement {
    start_date: string
    end_date: string
    discounts: PublisherDiscountType[]
}

interface PublisherDiscountType {
    percentage: number
    start_date: string
    end_date: string
    game: @PublisherGameType
}

interface PublisherGameApprovalRequestType {
    version: @PublisherVersionType
}

interface PublisherTransaction {
    id: string
    successful: boolean
    date: string
    amount: number
    game: @PublisherGameType
}

entry PublisherModel:
    (games+=Game | publishers+=Publisher | requests+=GameApprovalRequest | sales+=Sale | discounts+=Discount)*;

Game returns PublisherGameType:
    'game' name=ID
    'genre' genre+=[PublisherGenreType:ID] (',' genre+=[PublisherGenreType:ID])*
    'publisher' publisher=[PublisherType:ID]
    'price' price=INT
    'release_date' release_date=DATE
    'state' state=STRING
    'versions' versions+=Version (',' versions+=Version)*;
    

Publisher returns PublisherType:
    'publisher' name=ID 'balance' balance=INT;

Version returns PublisherVersionType:
    'version_id' ID=STRING
    'game_files' game_files=STRING
    'is_current' is_current=BOOLEAN
    'approved' approved=BOOLEAN;

GameApprovalRequest returns PublisherGameApprovalRequestType:
    'approval' 'request' 'version' version=[PublisherVersionType:STRING];

Discount returns PublisherDiscountType:
    'percentage' percentage=INT
    'start_date' start_date=DATE
    'end_date' end_date=DATE
    'game' game=[PublisherGameType:ID];

Sale returns PublisherSaleType:
    'sale' name=ID
    'start' start_date=DATE
    'end' end_date=DATE
    'discounts' discounts+=Discount (',' discounts+=Discount)*;


terminal BOOLEAN returns boolean: 'true' | 'false';
terminal DATE: /\d{2}-\d{2}-\d{4}/;
hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
