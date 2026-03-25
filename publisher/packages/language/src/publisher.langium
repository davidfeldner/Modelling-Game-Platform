grammar Publisher

interface NamedElement {
    name: string
}

interface GamePublisherType extends NamedElement {
}

interface GameType extends NamedElement {
    release_date: Date
    price: number
    state: string
    discounts: DiscountType[]
    versions: VersionType[]
    genre: @GenreType[]
    publisher: @GamePublisherType
}

interface GenreType extends NamedElement {
    description: string
}

interface VersionType {
    version_number: string
    is_current: boolean
}

interface ReviewType {
    content: string
    is_flagged: boolean
    game: @GameType
}

interface SaleType extends NamedElement {
    start_date: Date
    end_date: Date
    games: @GameType[]
}

interface DiscountType {
    percentage: number
    start_date: Date
    end_date: Date
}

interface GameApprovalRequestType {
    version: @VersionType
}

entry Model:
    (games+=Game | publishers+=GamePublisher | requests+=GameApprovalRequest | sales+=Sale | reviews+=Review | genres+=Genre)*;

Game returns GameType:
    'game' name=ID
    'genre' genre+=[GenreType:ID] (',' genre+=[GenreType:ID])*
    'publisher' publisher=[GamePublisherType:ID]
    'price' price=INT
    'release_date' release_date=DATE
    'state' state=STRING
    'versions' versions+=Version  (',' versions+=Version)*
    ('discounts' discounts+=Discount  (',' discounts+=Discount)*)?;

Genre returns GenreType:
    'genre' name=ID
    'description' description=STRING;

GamePublisher returns GamePublisherType:
    'publisher' name=ID;

Version returns VersionType:
    'version_id' version_number=STRING
    'is_current' is_current=BOOLEAN;

GameApprovalRequest returns GameApprovalRequestType:
    'approval' 'request' 'version' version=[VersionType:STRING];

Review returns ReviewType:
    'review' 'content' content=STRING
    'is_flagged' is_flagged=BOOLEAN
    'game' game=[GameType:ID];

Discount returns DiscountType:
    'percentage' percentage=INT
    'start_date' start_date=DATE
    'end_date' end_date=DATE;

Sale returns SaleType:
    'sale' name=ID
    'start' start_date=DATE
    'end' end_date=DATE
    'games' games+=[GameType:ID] (',' games+=[GameType:ID])*;


terminal BOOLEAN returns boolean: 'true' | 'false';
terminal DATE returns Date: /TIME/i;
hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
