#ifndef ALLPIECES_H
#define ALLPIECES_H

#include "Piece.h"

class Pawn : public Piece {
public:
    Pawn(Color pieceColor) : Piece(pieceColor, PieceType::PAWN) {}
    std::vector<std::pair<int, int>> getLegalMoves(int startX, int startY, class Board& board) const override;
};

class Knight : public Piece {
public:
    Knight(Color pieceColor) : Piece(pieceColor, PieceType::KNIGHT) {}
    std::vector<std::pair<int, int>> getLegalMoves(int startX, int startY, class Board& board) const override;
};

class Bishop : public Piece {
public:
    Bishop(Color pieceColor) : Piece(pieceColor, PieceType::BISHOP) {}
    std::vector<std::pair<int, int>> getLegalMoves(int startX, int startY, class Board& board) const override;
};

class Rook : public Piece {
public:
    Rook(Color pieceColor) : Piece(pieceColor, PieceType::ROOK) {}
    std::vector<std::pair<int, int>> getLegalMoves(int startX, int startY, class Board& board) const override;
};

class Queen : public Piece {
public:
    Queen(Color pieceColor) : Piece(pieceColor, PieceType::QUEEN) {}
    std::vector<std::pair<int, int>> getLegalMoves(int startX, int startY, class Board& board) const override;
};

class King : public Piece {
public:
    King(Color pieceColor) : Piece(pieceColor, PieceType::KING) {}
    std::vector<std::pair<int, int>> getLegalMoves(int startX, int startY, class Board& board) const override;
};

#endif // ALLPIECES_H