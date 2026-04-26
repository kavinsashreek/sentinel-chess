#include "Game.h"
#include "AllPieces.h"
#include <cstdlib>
#include <ctime>
#include <algorithm>

Game::Game() { srand(time(NULL)); aiDifficulty = 3; startNewGame(); }
void Game::setDifficulty(int level) { aiDifficulty = level; }
void Game::startNewGame() { board.initializeBoard(); currentTurn = Color::WHITE; }

bool Game::isSquareAttacked(int targetX, int targetY, Color attackerColor) {
    for (int x = 0; x < 8; ++x) {
        for (int y = 0; y < 8; ++y) {
            Piece* p = board.getPieceAt(x, y);
            if (p != nullptr && p->getColor() == attackerColor) {
                auto moves = p->getLegalMoves(x, y, board);
                for (auto m : moves) {
                    if (m.first == targetX && m.second == targetY) return true;
                }
            }
        }
    }
    return false;
}

bool Game::isKingInCheck(Color kingColor) {
    for (int x = 0; x < 8; ++x) {
        for (int y = 0; y < 8; ++y) {
            Piece* p = board.getPieceAt(x, y);
            if (p != nullptr && p->getColor() == kingColor && p->getType() == PieceType::KING) {
                Color attacker = (kingColor == Color::WHITE) ? Color::BLACK : Color::WHITE;
                return isSquareAttacked(x, y, attacker);
            }
        }
    }
    return false;
}

bool Game::hasLegalMoves(Color color) {
    for (int x = 0; x < 8; ++x) {
        for (int y = 0; y < 8; ++y) {
            Piece* p = board.getPieceAt(x, y);
            if (p != nullptr && p->getColor() == color) {
                auto moves = p->getLegalMoves(x, y, board);
                for (auto m : moves) {
                    bool originalMoved = p->getHasMoved();
                    Piece* captured = board.movePiece(x, y, m.first, m.second);
                    bool stillInCheck = isKingInCheck(color);
                    board.undoMove(x, y, m.first, m.second, captured, originalMoved);
                    if (!stillInCheck) return true;
                }
            }
        }
    }
    return false;
}

int Game::getGameState() {
    bool inCheck = isKingInCheck(currentTurn);
    bool canMove = hasLegalMoves(currentTurn);
    if (inCheck && !canMove) return 2; // Checkmate
    if (!inCheck && !canMove) return 3; // Stalemate
    if (inCheck) return 1; // Check
    return 0; // Normal
}

bool Game::makeMove(int startX, int startY, int endX, int endY) {
    Piece* p = board.getPieceAt(startX, startY);
    if (p == nullptr || p->getColor() != currentTurn) return false;

    auto moves = p->getLegalMoves(startX, startY, board);
    bool isLegal = false;
    for (const auto& move : moves) {
        if (move.first == endX && move.second == endY) { isLegal = true; break; }
    }

    if (isLegal) {
        bool originalMoved = p->getHasMoved();
        Piece* captured = board.movePiece(startX, startY, endX, endY);
        
        if (isKingInCheck(currentTurn)) {
            board.undoMove(startX, startY, endX, endY, captured, originalMoved);
            return false; 
        }

        // Pawn Promotion Logic
        if (p->getType() == PieceType::PAWN) {
            if ((p->getColor() == Color::WHITE && endY == 0) || (p->getColor() == Color::BLACK && endY == 7)) {
                Color c = p->getColor();
                delete p; 
                board.setPieceAt(endX, endY, new Queen(c)); 
            }
        }

        if (captured != nullptr) delete captured; 
        currentTurn = (currentTurn == Color::WHITE) ? Color::BLACK : Color::WHITE;
        return true;
    }
    return false;
}

std::vector<int> Game::getLegalMovesForUI(int x, int y) {
    std::vector<int> flatMoves;
    Piece* p = board.getPieceAt(x, y);
    if (p != nullptr && p->getColor() == currentTurn) {
        auto moves = p->getLegalMoves(x, y, board);
        for (auto m : moves) {
            bool originalMoved = p->getHasMoved();
            Piece* captured = board.movePiece(x, y, m.first, m.second);
            if (!isKingInCheck(currentTurn)) {
                flatMoves.push_back(m.first);
                flatMoves.push_back(m.second);
            }
            board.undoMove(x, y, m.first, m.second, captured, originalMoved);
        }
    }
    return flatMoves;
}

std::vector<int> Game::getHint() {
    int bestVal = 9999; 
    std::vector<int> hintCoords = {-1, -1, -1, -1};
    for (int x = 0; x < 8; ++x) {
        for (int y = 0; y < 8; ++y) {
            Piece* p = board.getPieceAt(x, y);
            if (p != nullptr && p->getColor() == currentTurn) { 
                auto moves = p->getLegalMoves(x, y, board);
                for (auto m : moves) {
                    bool originalMoved = p->getHasMoved();
                    Piece* captured = board.movePiece(x, y, m.first, m.second);
                    if(!isKingInCheck(currentTurn)) {
                        int moveVal = minimax(2, -10000, 10000, currentTurn == Color::WHITE);
                        if (currentTurn == Color::WHITE && moveVal < bestVal) {
                            bestVal = moveVal; hintCoords = {x, y, m.first, m.second};
                        } else if (currentTurn == Color::BLACK && moveVal > (bestVal == 9999 ? -9999 : bestVal)) {
                             bestVal = moveVal; hintCoords = {x, y, m.first, m.second};
                        }
                    }
                    board.undoMove(x, y, m.first, m.second, captured, originalMoved);
                }
            }
        }
    }
    return hintCoords;
}

int Game::evaluateBoard() {
    int score = 0;
    for (int x = 0; x < 8; ++x) {
        for (int y = 0; y < 8; ++y) {
            Piece* p = board.getPieceAt(x, y);
            if (p != nullptr) {
                int value = 0;
                switch (p->getType()) {
                    case PieceType::PAWN: value = 10; break;
                    case PieceType::KNIGHT: value = 30; break;
                    case PieceType::BISHOP: value = 30; break;
                    case PieceType::ROOK: value = 50; break;
                    case PieceType::QUEEN: value = 90; break;
                    case PieceType::KING: value = 900; break;
                    default: break;
                }
                if (p->getColor() == Color::BLACK) score += value;
                else score -= value;
            }
        }
    }
    return score;
}

int Game::minimax(int depth, int alpha, int beta, bool isMaximizingPlayer) {
    if (depth == 0) return evaluateBoard();
    if (isMaximizingPlayer) {
        int bestVal = -99999;
        for (int x = 0; x < 8; ++x) {
            for (int y = 0; y < 8; ++y) {
                Piece* p = board.getPieceAt(x, y);
                if (p != nullptr && p->getColor() == Color::BLACK) {
                    auto moves = p->getLegalMoves(x, y, board);
                    for (auto m : moves) {
                        bool originalMoved = p->getHasMoved();
                        Piece* captured = board.movePiece(x, y, m.first, m.second);
                        if(!isKingInCheck(Color::BLACK)) {
                            int value = minimax(depth - 1, alpha, beta, false);
                            bestVal = std::max(bestVal, value);
                            alpha = std::max(alpha, bestVal);
                        }
                        board.undoMove(x, y, m.first, m.second, captured, originalMoved);
                        if (beta <= alpha) return bestVal; 
                    }
                }
            }
        }
        return bestVal == -99999 ? -1000 : bestVal;
    } else {
        int bestVal = 99999;
        for (int x = 0; x < 8; ++x) {
            for (int y = 0; y < 8; ++y) {
                Piece* p = board.getPieceAt(x, y);
                if (p != nullptr && p->getColor() == Color::WHITE) {
                    auto moves = p->getLegalMoves(x, y, board);
                    for (auto m : moves) {
                        bool originalMoved = p->getHasMoved();
                        Piece* captured = board.movePiece(x, y, m.first, m.second);
                        if(!isKingInCheck(Color::WHITE)) {
                            int value = minimax(depth - 1, alpha, beta, true);
                            bestVal = std::min(bestVal, value);
                            beta = std::min(beta, bestVal);
                        }
                        board.undoMove(x, y, m.first, m.second, captured, originalMoved);
                        if (beta <= alpha) return bestVal; 
                    }
                }
            }
        }
        return bestVal == 99999 ? 1000 : bestVal;
    }
}

std::vector<int> Game::makeAIMove() {
    std::vector<int> chosenMove = {-1, -1, -1, -1};
    if (currentTurn != Color::BLACK) return chosenMove;
    
    int bestVal = -99999;
    
    struct MoveNode { int sx, sy, ex, ey; };
    std::vector<MoveNode> bestMoves;
    
    for (int x = 0; x < 8; ++x) {
        for (int y = 0; y < 8; ++y) {
            Piece* p = board.getPieceAt(x, y);
            if (p != nullptr && p->getColor() == Color::BLACK) {
                auto moves = p->getLegalMoves(x, y, board);
                for (auto m : moves) {
                    bool originalMoved = p->getHasMoved();
                    Piece* captured = board.movePiece(x, y, m.first, m.second);
                    if(!isKingInCheck(Color::BLACK)) {
                        int moveVal = minimax(aiDifficulty - 1, -100000, 100000, false);
                        
                        if (moveVal > bestVal) {
                            bestVal = moveVal;
                            bestMoves.clear();
                            bestMoves.push_back({x, y, m.first, m.second});
                        } else if (moveVal == bestVal) {
                            bestMoves.push_back({x, y, m.first, m.second});
                        }
                    }
                    board.undoMove(x, y, m.first, m.second, captured, originalMoved);
                }
            }
        }
    }
    
    if (!bestMoves.empty()) {
        int randIdx = rand() % bestMoves.size();
        MoveNode selected = bestMoves[randIdx];
        
        Piece* captured = board.movePiece(selected.sx, selected.sy, selected.ex, selected.ey);
        if (captured != nullptr) delete captured;
        
        currentTurn = Color::WHITE;
        chosenMove = {selected.sx, selected.sy, selected.ex, selected.ey};
    }
    return chosenMove;
}

int Game::getPieceTypeAt(int x, int y) { Piece* p = board.getPieceAt(x, y); return (p == nullptr) ? -1 : static_cast<int>(p->getType()); }
int Game::getPieceColorAt(int x, int y) { Piece* p = board.getPieceAt(x, y); return (p == nullptr) ? -1 : static_cast<int>(p->getColor()); }
int Game::getCurrentTurn() { return static_cast<int>(currentTurn); }

// --- LEARN MODULE ADDITIONS ---
void Game::clearBoardForScenario() {
    board.clearBoard(); 
}

void Game::setCustomPiece(int x, int y, int type, int color) {
    Color c = (color == 0) ? Color::WHITE : Color::BLACK;
    Piece* p = nullptr;
    switch(type) {
        case 0: p = new Pawn(c); break;
        case 1: p = new Knight(c); break;
        case 2: p = new Bishop(c); break;
        case 3: p = new Rook(c); break;
        case 4: p = new Queen(c); break;
        case 5: p = new King(c); break;
    }
    if (p != nullptr) {
        board.setPieceAt(x, y, p);
    }
}

void Game::forceTurn(int color) {
    currentTurn = (color == 0) ? Color::WHITE : Color::BLACK;
}