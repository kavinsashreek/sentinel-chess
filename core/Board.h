#ifndef BOARD_H
#define BOARD_H

#include "Piece.h"

class Board {
private:
    Piece* grid[8][8];

public:
    Board();
    ~Board();

    void initializeBoard();
    void clearBoard();

    Piece* getPieceAt(int x, int y) const;
    void setPieceAt(int x, int y, Piece* piece);
    
    // Updated for AI simulation
    Piece* movePiece(int startX, int startY, int endX, int endY);
    void undoMove(int startX, int startY, int endX, int endY, Piece* capturedPiece, bool originalHasMoved);
};

#endif // BOARD_H