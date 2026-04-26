#ifndef PIECE_H
#define PIECE_H

#include <vector>
#include <string>
#include <utility>

// Enum to represent the color of the pieces
enum class Color { WHITE, BLACK, NONE };

// Enum to represent piece types for easier logic later
enum class PieceType { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, EMPTY };

class Piece {
protected:
    // Encapsulation: Protected variables so child classes can access them, 
    // but the outside world cannot modify them directly.
    Color color;
    PieceType type;
    bool hasMoved;

public:
    // Constructor
    Piece(Color pieceColor, PieceType pieceType) 
        : color(pieceColor), type(pieceType), hasMoved(false) {}

    // Virtual Destructor (Crucial for Polymorphism)
    virtual ~Piece() = default;

    // Getters
    Color getColor() const { return color; }
    PieceType getType() const { return type; }
    bool getHasMoved() const { return hasMoved; }

    // Setters
    void setMoved(bool moved) { hasMoved = moved; }

    // Pure Virtual Function: This makes 'Piece' an Abstract Base Class.
    // Every specific piece (Pawn, Knight, etc.) MUST implement its own version of this function.
    virtual std::vector<std::pair<int, int>> getLegalMoves(int startX, int startY, class Board& board) const = 0;
};

#endif // PIECE_H