#include <emscripten/bind.h>
#include "Game.h"
using namespace emscripten;

EMSCRIPTEN_BINDINGS(chess_module) {
    register_vector<int>("VectorInt"); 
    class_<Game>("Game")
        .constructor<>()
        .function("startNewGame", &Game::startNewGame)
        .function("setDifficulty", &Game::setDifficulty)
        .function("makeMove", &Game::makeMove)
        .function("getPieceTypeAt", &Game::getPieceTypeAt)
        .function("getPieceColorAt", &Game::getPieceColorAt)
        .function("getCurrentTurn", &Game::getCurrentTurn)
        .function("getLegalMovesForUI", &Game::getLegalMovesForUI)
        .function("getGameState", &Game::getGameState)
        .function("getHint", &Game::getHint)
        .function("evaluateBoard", &Game::evaluateBoard)
        .function("makeAIMove", &Game::makeAIMove)
        .function("clearBoardForScenario", &Game::clearBoardForScenario) // NEW
        .function("setCustomPiece", &Game::setCustomPiece)               // NEW
        .function("forceTurn", &Game::forceTurn);                        // NEW
}