grammar Administrator

import "shared";

// From player:
interface AdministratorPlayerType extends NamedElement {
    balance: number
}
// From publisher:
interface AdministratorPublisherType extends NamedElement {
    balance: number
}

interface AdministratorType extends NamedElement {
}

interface AdministratorGameType extends NamedElement {
    release_date: string
    price: number
    state: string
    versions: AdministratorVersionType[]
    genres: @AdministratorGenreType[]
    publisher: @AdministratorPublisherType
    reviews?: AdministratorReviewType[]
}

interface AdministratorVersionType extends NamedElement {
    game_files: string
    is_current: boolean
    approved: boolean
}

interface AdministratorGameApprovalRequestType {
    game: @AdministratorGameType
    game_version: @AdministratorVersionType
    status: string
}

interface AdministratorGenreType extends NamedElement {
    description: string
}

interface AdministratorDiscountType extends NamedElement {
    percentage: number
    start_date: string
    end_date: string
    game: @AdministratorGameType
}

interface AdministratorSaleType extends NamedElement {
    start_date: string
    end_date: string
    discounts: @AdministratorDiscountType[]
}

interface AdministratorReviewType {
    content: string
    is_flagged: boolean
    author: @AdministratorPlayerType
}



entry AdministratorModel:
    (games+=AdministratorGame | administrators+=Administrator | requests+=GameApprovalRequest | sales+=AdministratorSale | discounts+=AdministratorDiscount | genres+=AdministratorGenre | publishers+=AdministratorPublisher | players+=AdministratorPlayer)*;

Administrator returns AdministratorType:
    'administrator' name=ID;

AdministratorGame returns AdministratorGameType:
    'game' name=ID
    'genres' genres+=[AdministratorGenreType:ID] (',' genres+=[AdministratorGenreType:ID])*
    'publisher' publisher=[AdministratorPublisherType:ID]
    'price' price=INT
    'release_date' release_date=DATE
    'state' state=STRING
    'versions' versions+=AdministratorVersion (',' versions+=AdministratorVersion)*
    ('reviews' reviews+=AdministratorReview (',' reviews+=AdministratorReview)*)?;

AdministratorGenre returns AdministratorGenreType:
    'genre' name=ID
    'description' description=STRING;

GameApprovalRequest returns AdministratorGameApprovalRequestType:
    'approval' 'request' 'game' game=[AdministratorGameType:ID] 'version' game_version=[AdministratorVersionType:ID] 'status' status=STRING;


AdministratorVersion returns AdministratorVersionType:
    'version_id' name=ID
    'game_files' game_files=STRING
    'is_current' is_current=BOOLEAN
    'approved' approved=BOOLEAN;

AdministratorSale returns AdministratorSaleType:
    'sale' name=ID
    'start_date' start_date=DATE
    'end_date' end_date=DATE
    'discounts' discounts+=[AdministratorDiscountType:ID] (',' discounts+=[AdministratorDiscountType:ID])*;

AdministratorDiscount returns AdministratorDiscountType:
    'discount' name=ID
    'percentage' percentage=INT
    'start_date' start_date=DATE
    'end_date' end_date=DATE
    'game' game=[AdministratorGameType:ID];

AdministratorReview returns AdministratorReviewType:
    'review' 'content' content=STRING
    'author' author=[AdministratorPlayerType:ID]
    'is_flagged' is_flagged=BOOLEAN;

AdministratorPublisher returns AdministratorPublisherType:
    'publisher' name=ID 'balance' balance=INT;

AdministratorPlayer returns AdministratorPlayerType:
    'player' name=ID 'balance' balance=INT;