grammar Player

import "publisher";

interface PlayerType extends NamedElement {
    balance: number
    library: PlayerLibraryType
    transactions?: PlayerTransactionType[]
}

interface PlayerLibraryType {
    games: @PlayerGameType[]
}

interface PlayerGenreType extends NamedElement {
    description: string
}
interface PlayerGameType extends NamedElement {
    release_date: string
    price: number
    versions: PlayerVersionType[]
    genre: @PlayerGenreType[]
    publisher: @PublisherType
    reviews?: PlayerReviewType[]
}

interface PlayerVersionType {
    ID: string
    game_files: string
}

interface PlayerReviewType {
    content: string
    is_flagged: boolean
    author: @PlayerType
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

interface PlayerTransactionType {
    id: string
    successful: boolean
    date: string
    amount: number
    game: @PlayerGameType
}



entry PlayerModel:
    player=Player (games+=PlayerGame | genres+=PlayerGenre | sales+=PlayerSale)*;

Player returns PlayerType:
    'player' name=ID
    'balance' balance=INT
    'library' library=Library
    ('transactions' transactions+=Transaction (',' transactions+=Transaction)*)?;

Library returns PlayerLibraryType:
    '[' (games+=[PlayerGameType:ID] (',' games+=[PlayerGameType:ID])*)? ']';

PlayerGenre returns PlayerGenreType:
    'genre' name=ID
    'description' description=STRING;

Transaction returns PlayerTransactionType:
    'transaction' 'id' id=ID
    'successful' successful=BOOLEAN
    'date' date=DATE
    'amount' amount=INT
    'game' game=[PlayerGameType:ID];

PlayerGame returns PlayerGameType:
    'game' name=ID
    'genre' genre+=[PlayerGenreType:ID] (',' genre+=[PlayerGenreType:ID])*
    'publisher' publisher=[PublisherType:ID]
    'price' price=INT
    'release_date' release_date=DATE
    'versions' versions+=PlayerVersion  (',' versions+=PlayerVersion)*
    ('reviews' reviews+=Review  (',' reviews+=Review)*)?;

PlayerVersion returns PlayerVersionType:
    'version_id' ID=STRING
    'game_files' game_files=STRING;

Review returns PlayerReviewType:
    'review' 'content' content=STRING
    'author' author=[PlayerType:ID]
    'is_flagged' is_flagged=BOOLEAN;

PlayerSale returns PlayerSaleType:
    'sale' name=ID
    'start' start_date=DATE
    'end' end_date=DATE
    'discounts' discounts+=PlayerDiscount (',' discounts+=PlayerDiscount)*;

PlayerDiscount returns PlayerDiscountType:
    'percentage' percentage=INT
    'start_date' start_date=DATE
    'end_date' end_date=DATE
    'game' game=[PlayerGameType:ID];
