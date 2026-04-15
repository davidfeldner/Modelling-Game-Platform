import { AstNode, AstNodeDescription, AstUtils, DefaultScopeProvider, EMPTY_SCOPE, ReferenceInfo, Scope, URI } from 'langium';
import { PublisherServices } from './publisher-module.js';
import { GenreType, isGameRef, isPlayerGameType, PlayerGameType, PlayerModel } from './generated/ast.js';

const json = {
    games: [{
        "name": "Skyrim",
        "genre": "Action",
        "publisher": "GameDev",
        "price": 1099,
        "release_date": "01-05-2026",
        "state": "0",
        "versions": [
            {
                "version_id": "0.0.1",
                "game_files": "skyrim_v0.0.1.exe",
                "is_current": true,
                "approved": true
            }
        ]
    }],
    genres: [{
        "name": "Action",
        "description": "something"
    }]
}



export class PlayerScopeProvider extends DefaultScopeProvider {
    constructor(services: PublisherServices) {
        super(services);
    }

    override getScope(context: ReferenceInfo): Scope {
        if ((isGameRef(context.container)) && context.property === 'game') {
            return this.getScopeForGames(context.container);
        }
        return super.getScope(context);
    }

    private getScopeForGames(node: AstNode): Scope {
        const model = this.getModel(node);
        const genres = this.getScopeForGenres(node)
        if (model) {
            const games: AstNodeDescription[] = json.games.map(g => {return {
                name: g.name,
                type: 'PlayerGameType',
                node: undefined,
                documentUri: URI.parse('json://games'),
                path: '',
            }})
            return this.createScope(games);
        }
        return EMPTY_SCOPE;        
    }

    private getScopeForGenres(node: AstNode): Scope {
        const model = this.getModel(node);
        if (model) {
            const genres: AstNodeDescription[] = [{
                name: json.genres[0].name,
                type: 'GenreType',
                node: undefined,
                documentUri: URI.parse('json://genres'),
                path: '',

            }]
            return this.createScope(genres);
        }
        return EMPTY_SCOPE;        
    }

    private getModel(node: AstNode): PlayerModel {
        let current = node;
        while (current.$container) {
            current = current.$container;
        }
        return current as PlayerModel;
    }
}