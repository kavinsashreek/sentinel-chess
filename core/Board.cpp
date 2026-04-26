#include "Board.h"
#include "AllPieces.h"

Board::Board() {
    for (int x = 0; x < 8; ++x) {
        for (int y = 0; y < 8; ++y) grid[x][y] = nullptr;
    }
}

Board::~Board() { clearBoard(); }

void Board::clearBoard() {
    for (int x = 0; x < 8; ++x) {
        for (int y = 0; y < 8; ++y) {
            if (grid[x][y] != nullptr) { delete grid[x][y]; grid[x][y] = nullptr; }
        }
    }
}

void Board::initializeBoard() {
    clearBoard();
    for (int x = 0; x < 8; ++x) {
        grid[x][1] = new Pawn(Color::BLACK); grid[x][6] = new Pawn(Color::WHITE); 
    }
    grid[0][0] = new Rook(Color::BLACK);   grid[7][0] = new Rook(Color::BLACK);
    grid[1][0] = new Knight(Color::BLACK); grid[6][0] = new Knight(Color::BLACK);
    grid[2][0] = new Bishop(Color::BLACK); grid[5][0] = new Bishop(Color::BLACK);
    grid[3][0] = new Queen(Color::BLACK);  grid[4][0] = new King(Color::BLACK);

    grid[0][7] = new Rook(Color::WHITE);   grid[7][7] = new Rook(Color::WHITE);
    grid[1][7] = new Knight(Color::WHITE); grid[6][7] = new Knight(Color::WHITE);
    grid[2][7] = new Bishop(Color::WHITE); grid[5][7] = new Bishop(Color::WHITE);
    grid[3][7] = new Queen(Color::WHITE);  grid[4][7] = new King(Color::WHITE);
}

Piece* Board::getPieceAt(int x, int y) const {
    if (x >= 0 && x < 8 && y >= 0 && y < 8) return grid[x][y];
    return nullptr;
}

void Board::setPieceAt(int x, int y, Piece* piece) {
    if (x >= 0 && x < 8 && y >= 0 && y < 8) grid[x][y] = piece;
}

Piece* Board::movePiece(int startX, int startY, int endX, int endY) {
    Piece* movingPiece = grid[startX][startY];
    Piece* capturedPiece = grid[endX][endY];

    // Special: Castling (Moving the Rook)
    if (movingPiece->getType() == PieceType::KING && abs(endX - startX) == 2) {
        if (endX == 6) { // King side
            grid[5][startY] = grid[7][startY]; grid[7][startY] = nullptr;
        } else if (endX == 2) { // Queen side
            grid[3][startY] = grid[0][startY]; grid[0][startY] = nullptr;
        }
    }

    grid[endX][endY] = movingPiece;
    grid[startX][startY] = nullptr;
    movingPiece->setMoved(true);
    return capturedPiece;
}

void Board::undoMove(int startX, int startY, int endX, int endY, Piece* capturedPiece, bool originalHasMoved) {
    Piece* movingPiece = grid[endX][endY];
    
    // Undo Castling
    if (movingPiece->getType() == PieceType::KING && abs(endX - startX) == 2) {
        if (endX == 6) { grid[7][startY] = grid[5][startY]; grid[5][startY] = nullptr; }
        else if (endX == 2) { grid[0][startY] = grid[3][startY]; grid[3][startY] = nullptr; }
    }

    grid[startX][startY] = movingPiece;
    grid[endX][endY] = capturedPiece;
    movingPiece->setMoved(originalHasMoved);
}