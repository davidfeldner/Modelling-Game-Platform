grammar Administrator

import "publisher";

// From player:
interface PlayerType extends NamedElement {
    balance: number
}

interface AdministratorType extends NamedElement {
}

interface AdministratorGameType extends NamedElement {
    release_date: string
    price: number
    state: string
    versions: AdministratorVersionType[]
    genre: @AdministratorGenreType[]
    publisher: @PublisherType
}

interface AdministratorVersionType {
    ID: string
    game_files: string
    is_current: boolean
    approved: boolean
}

interface AdministratorGameApprovalRequestType {
    game_version: @AdministratorVersionType
    status: string
}

interface AdministratorGenreType extends NamedElement {
    description: string
}

interface AdministratorDiscountType {
    percentage: number
    start_date: string
    end_date: string
    game: @AdministratorGameType
}

interface AdministratorSaleType extends NamedElement {
    start_date: string
    end_date: string
    discounts: AdministratorDiscountType[]
}

interface AdministratorReviewType {
    game: @AdministratorGameType
    content: string
    is_flagged: boolean
    author: @PlayerType
}



entry AdministratorModel:
    (games+=Game | administrators+=Administrator | requests+=GameApprovalRequest | sales+=AdministratorSale | discounts+=AdministratorDiscount | genres+=AdministratorGenre)*;

Administrator returns AdministratorType:
    'administrator' name=ID;

AdministratorGame returns AdministratorGameType:
    'game' name=ID
    'genre' genre+=[AdministratorGenreType:ID] (',' genre+=[AdministratorGenreType:ID])*
    'publisher' publisher=[PublisherType:ID]
    'price' price=INT
    'release_date' release_date=DATE
    'state' state=STRING
    'versions' versions+=AdministratorVersion (',' versions+=AdministratorVersion)*;

AdministratorGenre returns AdministratorGenreType:
    'genre' name=ID
    'description' description=STRING;

AdministratorVersion returns AdministratorVersionType:
    'version_id' ID=STRING
    'game_files' game_files=STRING
    'is_current' is_current=BOOLEAN
    'approved' approved=BOOLEAN;

AdministratorSale returns AdministratorSaleType:
    'sale' name=ID
    'start_date' start_date=DATE
    'end_date' end_date=DATE
    'discounts' discounts+=AdministratorDiscount (',' discounts+=AdministratorDiscount)*;

AdministratorDiscount returns AdministratorDiscountType:
    'percentage' percentage=INT
    'start_date' start_date=DATE
    'end_date' end_date=DATE
    'game' game=[AdministratorGameType:ID];

AdministratorReview returns AdministratorReviewType:
    'review' 'content' content=STRING
    'is_flagged' is_flagged=BOOLEAN
    'game' game=[AdministratorGameType:ID]
    'author' author=[PlayerType:ID];
