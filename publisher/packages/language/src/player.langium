grammar Player

import "publisher";

interface PlayerType extends NamedElement {
    balance: number
    library: LibraryType
    transactions?: TransactionType[]
}

interface LibraryType {
    games: @PlayerGameType[]
}

interface PlayerGameType extends NamedElement {
    release_date: string
    price: number
    versions: PlayerVersionType[]
    genre: @GenreType[]
    publisher: @GamePublisherType
}

interface PlayerVersionType {
    ID: string
    game_files: string
    
}

interface PlayerReviewType {
    game: @PlayerGameType
    content: string
    is_flagged: boolean
    
}

interface PlayerSaleType extends NamedElement {
    start_date: string
    end_date: string
    discounts: PlayerDiscountType[]
}

interface PlayerDiscountType {
    percentage: number
    start_date: string
    end_date: string
    game: @PlayerGameType
}

interface TransactionType {
    id: string
    successful: boolean
    date: string
    amount: number
    game: @PlayerGameType
}

entry PlayerModel:
    (games+= PlayerGame | players+=Player | reviews+=Review)*;

Player returns PlayerType:
    'player' name=ID
    'balance' balance=INT
    'library' library=Library
    ('transactions' transactions+=Transaction (',' transactions+=Transaction)*)?;

Library returns LibraryType:
    '[' (games+=[PlayerGameType:ID] (',' games+=[PlayerGameType:ID])*)? ']';

Transaction returns TransactionType:
    'transaction' 'id' id=ID
    'successful' successful=BOOLEAN
    'date' date=DATE
    'amount' amount=INT
    'game' game=[PlayerGameType:ID];

PlayerGame returns PlayerGameType:
    'game' name=ID
    'genre' genre+=[GenreType:ID] (',' genre+=[GenreType:ID])*
    'publisher' publisher=[GamePublisherType:ID]
    'price' price=INT
    'release_date' release_date=DATE
    'versions' versions+=PlayerVersion  (',' versions+=PlayerVersion)*;

PlayerVersion returns PlayerVersionType:
    'version_id' ID=STRING
    'game_files' game_files=STRING;

Review returns PlayerReviewType:
    'review' 'content' content=STRING
    'is_flagged' is_flagged=BOOLEAN
    'game' game=[PlayerGameType:ID];
