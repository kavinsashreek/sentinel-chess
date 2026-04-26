#ifndef GAME_H
#define GAME_H

#include "Board.h"
#include <vector>

class Game {
private:
    Board board;
    Color currentTurn;
    int aiDifficulty;

    int minimax(int depth, int alpha, int beta, bool isMaximizingPlayer);
    bool isSquareAttacked(int x, int y, Color attackerColor);
    bool isKingInCheck(Color kingColor);
    bool hasLegalMoves(Color color);

public:
    Game();
    
    void startNewGame();
    void setDifficulty(int level);
    bool makeMove(int startX, int startY, int endX, int endY);
    
    int getPieceTypeAt(int x, int y); 
    int getPieceColorAt(int x, int y);
    int getCurrentTurn();
    
    std::vector<int> getLegalMovesForUI(int x, int y); 
    int getGameState(); 
    std::vector<int> getHint(); 
    
    int evaluateBoard(); 
    std::vector<int> makeAIMove(); 

    // NEW: Expose functions for the Learn Tab to create custom puzzles
    void clearBoardForScenario();
    void setCustomPiece(int x, int y, int type, int color);
    void forceTurn(int color);
};

#endif // GAME_H