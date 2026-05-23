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
    versions: PublisherVersionType[]
    genres: @PublisherGenreType[]
    publisher: @PublisherType
    reviews?: PublisherReviewType[]
    purchased_count?: number
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

interface PublisherReviewType {
    content: string
    is_flagged: boolean
    author: string
}

entry PublisherModel:
    publisher=Publisher (games+=Game | sales+=Sale | discounts+=Discount | genres+=Genre )*;

Game returns PublisherGameType:
    'game' name=ID
    'genres' genres+=[PublisherGenreType:ID] (',' genres+=[PublisherGenreType:ID])*
    'publisher' publisher=[PublisherType:ID]
    'price' price=NUMBER
    'release_date' release_date=DATE
    'versions' versions+=Version (',' versions+=Version)*
    ('reviews' reviews+=Review  (',' reviews+=Review)*)?
    ('purchased_count' purchased_count=NUMBER)?;


Publisher returns PublisherType:
    'publisher' name=ID 'balance' balance=NUMBER;

Version returns PublisherVersionType:
    'version_id' name=STRING
    'game_files' game_files=STRING
    'is_current' is_current=BOOLEAN
    'approved' approved=BOOLEAN;

Review returns PublisherReviewType:
    'review' 'content' content=STRING
    'author' author=STRING
    'is_flagged' is_flagged=BOOLEAN;

Discount returns PublisherDiscountType:
    'discount' name=ID
    'percentage' percentage=NUMBER
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