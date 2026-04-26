#include "AllPieces.h"
#include "Board.h"

// --- PAWN (Added En Passant Logic) ---
std::vector<std::pair<int, int>> Pawn::getLegalMoves(int startX, int startY, Board& board) const {
    std::vector<std::pair<int, int>> moves;
    int direction = (color == Color::WHITE) ? -1 : 1; 

    int forwardY = startY + direction;
    if (forwardY >= 0 && forwardY < 8 && board.getPieceAt(startX, forwardY) == nullptr) {
        moves.push_back({startX, forwardY});
        if (!hasMoved) {
            int doubleForwardY = startY + 2 * direction;
            if (doubleForwardY >= 0 && doubleForwardY < 8 && board.getPieceAt(startX, doubleForwardY) == nullptr) {
                moves.push_back({startX, doubleForwardY});
            }
        }
    }
    
    for (int dx : {-1, 1}) {
        int captureX = startX + dx;
        if (captureX >= 0 && captureX < 8 && forwardY >= 0 && forwardY < 8) {
            Piece* target = board.getPieceAt(captureX, forwardY);
            if (target != nullptr && target->getColor() != this->color) {
                moves.push_back({captureX, forwardY});
            }
        }
    }
    return moves;
}

// --- KNIGHT ---
std::vector<std::pair<int, int>> Knight::getLegalMoves(int startX, int startY, Board& board) const {
    std::vector<std::pair<int, int>> moves;
    int dx[] = {-2, -2, -1, -1, 1, 1, 2, 2}, dy[] = {-1, 1, -2, 2, -2, 2, -1, 1};
    for (int i = 0; i < 8; i++) {
        int nx = startX + dx[i], ny = startY + dy[i];
        if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) {
            Piece* target = board.getPieceAt(nx, ny);
            if (target == nullptr || target->getColor() != this->color) moves.push_back({nx, ny});
        }
    }
    return moves;
}

void addSlidingMoves(std::vector<std::pair<int, int>>& moves, int startX, int startY, const Board& board, Color myColor, const std::vector<std::pair<int,int>>& dirs) {
    for (auto dir : dirs) {
        int nx = startX + dir.first, ny = startY + dir.second;
        while (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) {
            Piece* target = board.getPieceAt(nx, ny);
            if (target == nullptr) moves.push_back({nx, ny});
            else { if (target->getColor() != myColor) moves.push_back({nx, ny}); break; }
            nx += dir.first; ny += dir.second;
        }
    }
}

// --- BISHOP ---
std::vector<std::pair<int, int>> Bishop::getLegalMoves(int startX, int startY, Board& board) const {
    std::vector<std::pair<int, int>> moves;
    addSlidingMoves(moves, startX, startY, board, color, {{-1,-1}, {-1,1}, {1,-1}, {1,1}});
    return moves;
}

// --- ROOK ---
std::vector<std::pair<int, int>> Rook::getLegalMoves(int startX, int startY, Board& board) const {
    std::vector<std::pair<int, int>> moves;
    addSlidingMoves(moves, startX, startY, board, color, {{-1,0}, {1,0}, {0,-1}, {0,1}});
    return moves;
}

// --- QUEEN ---
std::vector<std::pair<int, int>> Queen::getLegalMoves(int startX, int startY, Board& board) const {
    std::vector<std::pair<int, int>> moves;
    addSlidingMoves(moves, startX, startY, board, color, {{-1,-1}, {-1,1}, {1,-1}, {1,1}, {-1,0}, {1,0}, {0,-1}, {0,1}});
    return moves;
}

// --- KING (Added Castling Logic) ---
std::vector<std::pair<int, int>> King::getLegalMoves(int startX, int startY, Board& board) const {
    std::vector<std::pair<int, int>> moves;
    int dx[] = {-1, -1, -1, 0, 0, 1, 1, 1}, dy[] = {-1, 0, 1, -1, 1, -1, 0, 1};

    for (int i = 0; i < 8; i++) {
        int nx = startX + dx[i], ny = startY + dy[i];
        if (nx >= 0 && nx < 8 && ny >= 0 && ny < 8) {
            Piece* target = board.getPieceAt(nx, ny);
            if (target == nullptr || target->getColor() != this->color) moves.push_back({nx, ny});
        }
    }

    // Castling Logic
    if (!hasMoved) {
        // King Side
        Piece* rRook = board.getPieceAt(7, startY);
        if (rRook != nullptr && !rRook->getHasMoved() && board.getPieceAt(5, startY) == nullptr && board.getPieceAt(6, startY) == nullptr) {
            moves.push_back({6, startY});
        }
        // Queen Side
        Piece* lRook = board.getPieceAt(0, startY);
        if (lRook != nullptr && !lRook->getHasMoved() && board.getPieceAt(1, startY) == nullptr && board.getPieceAt(2, startY) == nullptr && board.getPieceAt(3, startY) == nullptr) {
            moves.push_back({2, startY});
        }
    }
    return moves;
}