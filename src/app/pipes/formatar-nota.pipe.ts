import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatarNota'
})
export class FormatarNotaPipe implements PipeTransform {

  transform(rating: number | null | undefined): string {
    // Verifica se o rating é válido
    if (rating === null || rating === undefined || isNaN(rating)) {
      return 'N/A';
    }

    // Converte para escala de 0-5
    const scaledRating = (rating / 20); // 100 ÷ 20 = 5
    
    // Sempre formata com uma casa decimal
    return scaledRating.toFixed(1);
  }
}