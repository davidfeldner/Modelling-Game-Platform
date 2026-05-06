type GameTypeName = string ;
type PlayerTypeName = string ;
type PublisherTypeName = string ;
type GenreTypeName = string ;
type VersionTypeID = string ;
type SaleTypeName = string ;
type DiscountTypeName = string ;
type AdministratorTypeName = string ;
type ReviewTypeContent = string ;
type TransactionTypeID = string ;

interface NamedElement {
    name: string
}

interface PublisherType extends NamedElement {
    balance: number
}

interface GameType extends NamedElement {
    release_date: string
    price: number
    state: string
    versions: VersionType[]
    genres: GenreTypeName[]
    publisher: PublisherType
    reviews: ReviewType[]
}

interface GenreType extends NamedElement {
    description: string
}

interface VersionType {
    version_id: string
    game_files: string
    is_current: boolean
    approved: boolean
}

interface SaleType extends NamedElement {
    start_date: string
    end_date: string
    discounts: DiscountType[]
}

interface DiscountType extends NamedElement{
    percentage: number
    start_date: string
    end_date: string
    game: GameTypeName
}

interface GameApprovalRequestType {
    game: GameTypeName
    game_version: VersionTypeName
    status: string
}

interface TransactionType {
    id: string
    successful: boolean
    date: string
    amount: number
    game: GameType
}

interface AdministratorType extends NamedElement {
}

interface ReviewType {
    content: string
    is_flagged: boolean
    author: PlayerType
}

interface PlayerType extends NamedElement {
    balance: number
    library: LibraryType
    transactions?: PlayerTransactionType[]
}

interface LibraryType {
    games: GameTypeName[]
}



export interface databaseModel {
    discounts: DiscountType[];
    games: GameType[];
    publishers: PublisherType[];
    administrators: AdministratorType[];
    players: PlayerType[];
    genres: GenreType[];
    requests: GameApprovalRequestType[];
    sales: SaleType[];
    reviews: ReviewType[];
    transactions: TransactionType[];
}
