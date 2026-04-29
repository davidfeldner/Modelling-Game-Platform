grammar Publisher

import "shared"

// From player:
interface PublisherPlayerType extends NamedElement {
    balance: number
}


interface PublisherType extends NamedElement {
    balance: number
}

interface PublisherGameType extends NamedElement {
    release_date: string
    price: number
    state: string
    versions: PublisherVersionType[]
    genres: @PublisherGenreType[]
    publisher: @PublisherType
}

interface PublisherGenreType extends NamedElement {
    description: string
}

interface PublisherVersionType extends NamedElement {
    game_files: string
    is_current: boolean
    approved: boolean
}

interface PublisherSaleType extends NamedElement {
    start_date: string
    end_date: string
    discounts: @PublisherDiscountType[]
}

interface PublisherDiscountType extends NamedElement {
    percentage: number
    start_date: string
    end_date: string
    game: @PublisherGameType
}

interface PublisherTransaction {
    id: string
    successful: boolean
    date: string
    amount: number
    game: @PublisherGameType
}

interface PublisherReviewType {
    content: string
    is_flagged: boolean
    author: @PublisherPlayerType
}

entry PublisherModel:
    (games+=Game | publishers+=Publisher | sales+=Sale | discounts+=Discount | genres+=Genre )*;

Game returns PublisherGameType:
    'game' name=ID
    'genres' genres+=[PublisherGenreType:ID] (',' genres+=[PublisherGenreType:ID])*
    'publisher' publisher=[PublisherType:ID]
    'price' price=INT
    'release_date' release_date=DATE
    'state' state=STRING
    'versions' versions+=Version (',' versions+=Version)*;


Publisher returns PublisherType:
    'publisher' name=ID 'balance' balance=INT;

Version returns PublisherVersionType:
    'version_id' name=ID
    'game_files' game_files=STRING
    'is_current' is_current=BOOLEAN
    'approved' approved=BOOLEAN;

Discount returns PublisherDiscountType:
    'discount' name=ID
    'percentage' percentage=INT
    'start_date' start_date=DATE
    'end_date' end_date=DATE
    'game' game=[PublisherGameType:ID];

Sale returns PublisherSaleType:
    'sale' name=ID
    'start_date' start_date=DATE
    'end_date' end_date=DATE
    'discounts' discounts+=[PublisherDiscountType:ID] (',' discounts+=[PublisherDiscountType:ID])*;

Genre returns PublisherGenreType:
    'genre' name=ID
    'description' description=STRING;