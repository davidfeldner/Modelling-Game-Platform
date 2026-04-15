grammar Publisher

interface NamedElement {
    name: string
}

interface GamePublisherType extends NamedElement {
    balance: number
}

interface GameType extends NamedElement {
    release_date: string
    price: number
    state: string
    versions: VersionType[]
    genre: @GenreType[]
    publisher: @GamePublisherType
}

interface GenreType extends NamedElement {
    description: string
}

interface VersionType {
    ID: string
    game_files: string
    is_current: boolean
    approved: boolean
}

interface SaleType extends NamedElement {
    start_date: string
    end_date: string
    discounts: DiscountType[]
}

interface DiscountType {
    percentage: number
    start_date: string
    end_date: string
    game: @GameType
}

interface GameApprovalRequestType {
    version: @VersionType
}





entry PublisherModel:
    (games+=Game | publishers+=GamePublisher | requests+=GameApprovalRequest | sales+=Sale)*;

Game returns GameType:
    'game' name=ID
    'genre' genre+=[GenreType:ID] (',' genre+=[GenreType:ID])*
    'publisher' publisher=[GamePublisherType:ID]
    'price' price=INT
    'release_date' release_date=DATE
    'state' state=STRING
    'versions' versions+=Version (',' versions+=Version)*;
    



GamePublisher returns GamePublisherType:
    'publisher' name=ID 'balance' balance=INT;

Version returns VersionType:
    'version_id' ID=STRING
    'game_files' game_files=STRING
    'is_current' is_current=BOOLEAN
    'approved' approved=BOOLEAN;

GameApprovalRequest returns GameApprovalRequestType:
    'approval' 'request' 'version' version=[VersionType:STRING];



Discount returns DiscountType:
    'percentage' percentage=INT
    'start_date' start_date=DATE
    'end_date' end_date=DATE
    'game' game=[GameType:ID];

Sale returns SaleType:
    'sale' name=ID
    'start' start_date=DATE
    'end' end_date=DATE
    'discounts' discounts+=Discount  (',' discounts+=Discount)*;


terminal BOOLEAN returns boolean: 'true' | 'false';
terminal DATE: /\d{2}-\d{2}-\d{4}/;
hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /"(\\.|[^"\\])*"|'(\\.|[^'\\])*'/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
