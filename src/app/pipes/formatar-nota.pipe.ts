import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatarNota'
})
export class FormatarNotaPipe implements PipeTransform {

  transform(rating: number): number {
    const scaledRating = (rating / 100) * 5;

    return parseFloat(scaledRating.toFixed(1));
  }

}
